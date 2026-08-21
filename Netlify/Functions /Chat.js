exports.handler = async (event) => {
  // =========================================================
  // NOVA — Netlify Gemini AI Function
  // Model: Gemini 3.6 Flash
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
    // Parse request
    // -------------------------------------------------------
    let requestBody;

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

    const message =
      typeof requestBody.message === 'string'
        ? requestBody.message.trim()
        : '';

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
        'GEMINI_API_KEY is missing from Netlify Environment Variables'
      );
    }

    // -------------------------------------------------------
    // Gemini model
    // -------------------------------------------------------
    const MODEL =
      'gemini-3.6-flash';

    // -------------------------------------------------------
    // Build conversation contents
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
    // Gemini Generate Content API
    // -------------------------------------------------------
    const apiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response =
      await fetch(apiUrl, {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          contents,

          generationConfig: {
            maxOutputTokens: 2048
          }
        })
      });

    // -------------------------------------------------------
    // Read response
    // -------------------------------------------------------
    const data =
      await response.json();

    // -------------------------------------------------------
    // Gemini API error
    // -------------------------------------------------------
    if (!response.ok) {
      console.error(
        'Gemini API Error:',
        JSON.stringify(
          data,
          null,
          2
        )
      );

      const apiError =
        data?.error?.message ||
        `Gemini API request failed (${response.status})`;

      return {
        statusCode: response.status,

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          error: apiError
        })
      };
    }

    // -------------------------------------------------------
    // Extract response text
    // -------------------------------------------------------
    const candidates =
      Array.isArray(data?.candidates)
        ? data.candidates
        : [];

    let reply = '';

    for (const candidate of candidates) {
      const parts =
        candidate?.content?.parts;

      if (!Array.isArray(parts)) {
        continue;
      }

      for (const part of parts) {
        if (
          typeof part?.text === 'string'
        ) {
          reply += part.text;
        }
      }
    }

    reply = reply.trim();

    // -------------------------------------------------------
    // No response
    // -------------------------------------------------------
    if (!reply) {
      console.error(
        'Gemini returned no text:',
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return {
        statusCode: 502,

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          error:
            'Gemini returned an empty response'
        })
      };
    }

    // -------------------------------------------------------
    // Success
    // -------------------------------------------------------
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

  } catch (error) {
    // -------------------------------------------------------
    // Unexpected server error
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
