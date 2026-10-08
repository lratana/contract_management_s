
export default async function handler(request) {
  const GAS_URL = process.env.GAS_WEB_APP_URL;
  const API_SECRET = process.env.APPS_SCRIPT_API_SECRET;

  // ------------------------------------------------------------
  // 1. Check environment variables
  // ------------------------------------------------------------

  if (!GAS_URL) {
    return json(
      {
        success: false,
        errorCode: "CONFIG_ERROR",
        message: "GAS_WEB_APP_URL is not configured.",
      },
      500
    );
  }

  if (!API_SECRET) {
    return json(
      {
        success: false,
        errorCode: "CONFIG_ERROR",
        message: "APPS_SCRIPT_API_SECRET is not configured.",
      },
      500
    );
  }

  // ------------------------------------------------------------
  // 2. Read request from React
  // ------------------------------------------------------------

  try {
    let payload = {};

    if (request.method === "GET") {
      const url = new URL(request.url);

      payload = {
        action: url.searchParams.get("action") || "health",
      };
    } else {
      const contentType = request.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        payload = await request.json();
      } else {
        return json(
          {
            success: false,
            errorCode: "INVALID_CONTENT_TYPE",
            message: "Request must use Content-Type: application/json.",
          },
          400
        );
      }
    }

    // ----------------------------------------------------------
    // 3. Validate payload
    // ----------------------------------------------------------

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json(
        {
          success: false,
          errorCode: "INVALID_REQUEST",
          message: "Invalid API request body.",
        },
        400
      );
    }

    // ----------------------------------------------------------
    // 4. Add server-side secret
    // ----------------------------------------------------------

    payload.apiSecret = API_SECRET;

    // ----------------------------------------------------------
    // 5. Call Google Apps Script
    // ----------------------------------------------------------

    const gasResponse = await fetch(GAS_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    // ----------------------------------------------------------
    // 6. Read Apps Script response
    // ----------------------------------------------------------

    const text = await gasResponse.text();

    const contentType =
      gasResponse.headers.get("content-type") || "";

    // ----------------------------------------------------------
    // 7. Try to parse JSON
    // ----------------------------------------------------------

    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      // Google Apps Script returned HTML / non-JSON.
      // Return a valid JSON response to React.

      const preview = String(text || "")
        .replace(/\s+/g, " ")
        .slice(0, 500);

      return json(
        {
          success: false,
          errorCode: "GAS_INVALID_RESPONSE",
          message:
            gasResponse.status === 200
              ? "Google Apps Script returned HTTP 200 but the response was not valid JSON."
              : `Google Apps Script returned HTTP ${gasResponse.status}.`,
          gasStatus: gasResponse.status,
          gasContentType: contentType,
          responsePreview: preview,
        },
        gasResponse.status >= 400 ? gasResponse.status : 502
      );
    }

    // ----------------------------------------------------------
    // 8. Always return valid JSON to React
    // ----------------------------------------------------------

    return json(
      data,
      gasResponse.status
    );

  } catch (error) {
    // ----------------------------------------------------------
    // 9. Netlify / Fetch / Request error
    // ----------------------------------------------------------

    return json(
      {
        success: false,
        errorCode: "NETLIFY_PROXY_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Proxy request failed.",
      },
      500
    );
  }
}

// ============================================================
// JSON Response Helper
// ============================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

// ============================================================
// Netlify Function Configuration
// ============================================================

export const config = {
  path: "/api",
};
