exports.handler = async (event) => {
  // =========================================================
  // NOVA AI — Netlify Function
  // Google Gemini API
  // Model: Gemini 3.7 Flash
  // =========================================================

  // Only allow POST requests
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
    // Get Gemini API key
    // -------------------------------------------------------
    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured in Netlify'
      );
    }

    // -------------------------------------------------------
    // Gemini model
    // -------------------------------------------------------
    const MODEL =
      'gemini-3.7-flash';

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
    // Add current user message
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
    // Gemini API URL
    // -------------------------------------------------------
    const API_URL =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    // -------------------------------------------------------
    // Call Gemini API
    // -------------------------------------------------------
    const response =
      await fetch(API_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          // Recommended API key header
          'x-goog-api-key': apiKey
        },

        body: JSON.stringify({
          contents,

          generationConfig: {
            maxOutputTokens: 2048
          }
        })
      });

    // -------------------------------------------------------
    // Read response safely
    // -------------------------------------------------------
    const rawText =
      await response.text();

    let data = {};

    try {
      data =
        rawText
          ? JSON.parse(rawText)
          : {};
    } catch (error) {
      console.error(
        'Invalid Gemini response:',
        rawText
      );

      throw new Error(
        'Gemini returned an invalid response'
      );
    }

    // -------------------------------------------------------
    // Handle Gemini errors
    // -------------------------------------------------------
    if (!response.ok) {
      console.error(
        'Gemini API error:',
        response.status,
        data
      );

      return {
        statusCode: response.status,

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          error:
            data?.error?.message ||
            `Gemini API error (${response.status})`
        })
      };
    }

    // -------------------------------------------------------
    // Extract AI reply
    // -------------------------------------------------------
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

    // -------------------------------------------------------
    // Check for empty response
    // -------------------------------------------------------
    if (!reply) {
      console.error(
        'No reply received:',
        data
      );

      return {
        statusCode: 502,

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          error:
            'Gemini returned no text response'
        })
      };
    }

    // -------------------------------------------------------
    // Success
    // -------------------------------------------------------
    return {
      statusCode: 200,

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        reply
      })
    };

  } catch (error) {
    console.error(
      'NOVA SERVER ERROR:',
      error
    );

    return {
      statusCode: 500,

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        error:
          error?.message ||
          'Internal server error'
      })
    };
  }
};
