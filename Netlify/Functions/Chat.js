exports.handler = async (event) => {
  // =========================================================
  // NOVA — Netlify Function
  // Gemini 3.6 Flash
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
    let body;

    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Invalid JSON request body'
        })
      };
    }

    const {
      message,
      history = []
    } = body;

    // -------------------------------------------------------
    // Validate message
    // -------------------------------------------------------
    if (
      typeof message !== 'string' ||
      !message.trim()
    ) {
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
        'GEMINI_API_KEY is not configured in Netlify Environment Variables'
      );
    }

    // -------------------------------------------------------
    // Prepare conversation history
    // -------------------------------------------------------
    const contents = [];

    if (Array.isArray(history)) {
      history.forEach((msg) => {
        if (
          !msg ||
          typeof msg.content !== 'string' ||
          !msg.content.trim()
        ) {
          return;
        }

        contents.push({
          role:
            msg.role === 'ai'
              ? 'model'
              : 'user',

          parts: [
            {
              text: msg.content
            }
          ]
        });
      });
    }

    // -------------------------------------------------------
    // Add current user message
    // -------------------------------------------------------
    contents.push({
      role: 'user',

      parts: [
        {
          text: message.trim()
        }
      ]
    });

    // -------------------------------------------------------
    // Gemini 3.6 Flash API
    // -------------------------------------------------------
    const MODEL =
      'gemini-3.6-flash';

    const API_URL =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(
      API_URL,
      {
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
      }
    );

    // -------------------------------------------------------
    // Read Gemini response
    // -------------------------------------------------------
    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        'Gemini API error:',
        data
      );

      return {
        statusCode: response.status,

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          error:
            data?.error?.message ||
            'Gemini API request failed'
        })
      };
    }

    // -------------------------------------------------------
    // Extract AI response
    // -------------------------------------------------------
    const reply =
      data
        ?.candidates?.[0]
        ?.content?.parts
        ?.map(
          (part) =>
            part.text || ''
        )
        .join('')
        .trim();

    // -------------------------------------------------------
    // Check empty response
    // -------------------------------------------------------
    if (!reply) {
      console.error(
        'Unexpected Gemini response:',
        data
      );

      throw new Error(
        'No reply received from Gemini'
      );
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
    // Server error
    // -------------------------------------------------------
    console.error(
      'Nova server error:',
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
