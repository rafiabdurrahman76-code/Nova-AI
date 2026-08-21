exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Method Not Allowed'
      })
    };
  }

  try {
    const { message, history = [] } = JSON.parse(event.body || '{}');

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Message is required'
        })
      };
    }

    // Gemini API key from Netlify Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Prepare conversation history
    const contents = [];

    history.forEach((msg) => {
      if (!msg.content) return;

      contents.push({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [
          {
            text: msg.content
          }
        ]
      });
    });

    // Add current user message
    contents.push({
      role: 'user',
      parts: [
        {
          text: message
        }
      ]
    });

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);

      return {
        statusCode: response.status,
        body: JSON.stringify({
          error:
            data?.error?.message ||
            'Gemini API request failed'
        })
      };
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim();

    if (!reply) {
      throw new Error('No reply received from Gemini');
    }

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
    console.error('Server error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};