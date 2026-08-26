exports.handler = async (event) => {
  // =========================================================
  // NOVA AI — Netlify Function
  // Google Gemini API
  // Automatic model fallback
  // =========================================================

  // ---------------------------------------------------------
  // Only allow POST
  // ---------------------------------------------------------
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Method Not Allowed'
      })
    };
  }

  try {
    // -------------------------------------------------------
    // Parse request body
    // -------------------------------------------------------
    let requestBody = {};

    try {
      requestBody = JSON.parse(
        event.body || '{}'
      );
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Invalid JSON request'
        })
      };
    }

    // -------------------------------------------------------
    // Get message
    // -------------------------------------------------------
    const message =
      typeof requestBody.message === 'string'
        ? requestBody.message.trim()
        : '';

    // -------------------------------------------------------
    // Get history
    // -------------------------------------------------------
    const history =
      Array.isArray(requestBody.history)
        ? requestBody.history
        : [];

    // -------------------------------------------------------
    // Validate message
    // -------------------------------------------------------
    if (!message) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Message is required'
        })
      };
    }

    // -------------------------------------------------------
    // Gemini API key
    // -------------------------------------------------------
    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured in Netlify'
      );
    }

    // -------------------------------------------------------
    // Models
    //
    // First:
    // Gemini 3.7 Flash
    //
    // If temporarily unavailable:
    // Gemini 3.6 Flash
    //
    // Final fallback:
    // Gemini 3.5 Flash
    // -------------------------------------------------------
    const MODELS = [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash'
    ];

    // -------------------------------------------------------
    // Build conversation history
    // -------------------------------------------------------
    const contents = [];

    for (const msg of history) {
      if (
        !msg ||
        typeof msg.content !== 'string'
      ) {
        continue;
      }

      const content =
        msg.content.trim();

      if (!content) {
        continue;
      }

      contents.push({
        role:
          msg.role === 'ai'
            ? 'model'
            : 'user',

        parts: [
          {
            text: content
          }
        ]
      });
    }

    // -------------------------------------------------------
    // Current user message
    // -------------------------------------------------------
    contents.push({
      role: 'user',

      parts: [
        {
          text: message
        }
      ]
    });

    // -------------------------------------------------------
    // Try models one by one
    // -------------------------------------------------------
    let lastError =
      'Gemini request failed';

    for (const MODEL of MODELS) {

      try {
        console.log(
          `Trying Gemini model: ${MODEL}`
        );

        const API_URL =
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

        const response =
          await fetch(
            API_URL,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                'x-goog-api-key':
                  apiKey
              },

              body: JSON.stringify({
                contents,

                generationConfig: {
                  maxOutputTokens: 2048
                }
              })
            }
          );

        // ---------------------------------------------------
        // Read response
        // ---------------------------------------------------
        const rawText =
          await response.text();

        let data = {};

        try {
          data =
            rawText
              ? JSON.parse(rawText)
              : {};
        } catch (error) {

          lastError =
            `Invalid response from ${MODEL}`;

          console.error(
            lastError,
            rawText
          );

          continue;
        }

        // ---------------------------------------------------
        // Handle Gemini error
        // ---------------------------------------------------
        if (!response.ok) {

          const errorMessage =
            data?.error?.message ||
            `Gemini API error (${response.status})`;

          console.error(
            `${MODEL} failed:`,
            response.status,
            errorMessage
          );

          lastError =
            errorMessage;

          // -----------------------------------------------
          // Try next model for temporary/server/rate errors
          // -----------------------------------------------
          if (
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ) {
            continue;
          }

          // -----------------------------------------------
          // Model not found / unavailable
          // Try next model
          // -----------------------------------------------
          if (
            response.status === 404
          ) {
            continue;
          }

          // -----------------------------------------------
          // Other API errors
          // Don't hide them
          // -----------------------------------------------
          return {
            statusCode:
              response.status,

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              error:
                errorMessage
            })
          };
        }

        // ---------------------------------------------------
        // Extract reply
        // ---------------------------------------------------
        const reply =
          data?.candidates?.[0]?.content?.parts
            ?.map(
              (part) =>
                typeof part.text === 'string'
                  ? part.text
                  : ''
            )
            .join('')
            .trim();

        // ---------------------------------------------------
        // Empty response
        // ---------------------------------------------------
        if (!reply) {

          console.error(
            `${MODEL} returned no text`
          );

          lastError =
            `${MODEL} returned no text response`;

          continue;
        }

        // ---------------------------------------------------
        // SUCCESS
        // ---------------------------------------------------
        console.log(
          `Gemini success using: ${MODEL}`
        );

        return {
          statusCode: 200,

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            reply
          })
        };

      } catch (modelError) {

        console.error(
          `${MODEL} connection error:`,
          modelError
        );

        lastError =
          modelError?.message ||
          `Failed to connect to ${MODEL}`;

        // Try next model
        continue;
      }
    }

    // -------------------------------------------------------
    // All models failed
    // -------------------------------------------------------
    return {
      statusCode: 503,

      headers: {
        'Content-Type':
          'application/json'
      },

      body: JSON.stringify({
        error:
          'All Gemini models are temporarily unavailable. Please try again shortly.',
        details:
          lastError
      })
    };

  } catch (error) {

    // -------------------------------------------------------
    // General server error
    // -------------------------------------------------------
    console.error(
      'NOVA SERVER ERROR:',
      error
    );

    return {
      statusCode: 500,

      headers: {
        'Content-Type':
          'application/json'
      },

      body: JSON.stringify({
        error:
          error?.message ||
          'Internal server error'
      })
    };
  }
};
