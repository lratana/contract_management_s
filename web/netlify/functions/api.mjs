// ============================================================
// Netlify Function
// /api
//
// React
//   ↓
// Netlify Function
//   ↓
// Google Apps Script Web App /exec
//   ↓
// Google Sheets / Drive
// ============================================================

export default async function handler(request) {
  const GAS_URL = String(
    process.env.GAS_WEB_APP_URL || ""
  ).trim();

  const API_SECRET = String(
    process.env.APPS_SCRIPT_API_SECRET || ""
  ).trim();

  // ------------------------------------------------------------
  // 1. Environment validation
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
  // 2. Read request
  // ------------------------------------------------------------

  try {
    let payload = {};

    // ----------------------------------------------------------
    // GET
    // Example:
    // /api?action=health
    // ----------------------------------------------------------

    if (request.method === "GET") {
      const url = new URL(request.url);

      payload = {
        action: url.searchParams.get("action") || "health",
      };

    } else {

      // --------------------------------------------------------
      // POST
      // --------------------------------------------------------

      const contentType =
        request.headers.get("content-type") || "";

      if (!contentType.toLowerCase().includes("application/json")) {
        return json(
          {
            success: false,
            errorCode: "INVALID_CONTENT_TYPE",
            message:
              "Request must use Content-Type: application/json.",
          },
          400
        );
      }

      payload = await request.json();
    }

    // ----------------------------------------------------------
    // 3. Validate payload
    // ----------------------------------------------------------

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
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
    //
    // IMPORTANT:
    // Never put this secret in React/frontend.
    // ----------------------------------------------------------

    payload.apiSecret = API_SECRET;

    // ----------------------------------------------------------
    // 5. Call Google Apps Script
    // ----------------------------------------------------------

    const gasResponse = await fetch(GAS_URL, {
      method: "POST",

      // Google Apps Script Web App may redirect.
      redirect: "follow",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(payload),
    });

    // ----------------------------------------------------------
    // 6. Read response
    // ----------------------------------------------------------

    const text = await gasResponse.text();

    const gasContentType =
      gasResponse.headers.get("content-type") || "";

    // ----------------------------------------------------------
    // 7. Parse JSON
    // ----------------------------------------------------------

    let data;

    try {
      data = JSON.parse(text);

    } catch (parseError) {

      const preview = String(text || "")
        .replace(/\s+/g, " ")
        .slice(0, 1000);

      return json(
        {
          success: false,

          errorCode: "GAS_INVALID_RESPONSE",

          message:
            gasResponse.status === 200
              ? "Google Apps Script returned HTTP 200 but the response was not valid JSON."
              : `Google Apps Script returned HTTP ${gasResponse.status}.`,

          gasStatus: gasResponse.status,

          gasContentType,

          gasUrl:
            GAS_URL
              .replace(/\/exec.*$/i, "/exec"),

          responsePreview: preview,

          hint:
            "Check that GAS_WEB_APP_URL is the deployed Google Apps Script Web App /exec URL and that the latest version containing doPost(e) has been deployed.",
        },

        gasResponse.status >= 400
          ? gasResponse.status
          : 502
      );
    }

    // ----------------------------------------------------------
    // 8. Return GAS JSON to frontend
    // ----------------------------------------------------------

    return json(
      data,
      gasResponse.status
    );

  } catch (error) {

    // ----------------------------------------------------------
    // 9. Network / Fetch / Runtime error
    // ----------------------------------------------------------

    return json(
      {
        success: false,

        errorCode: "NETLIFY_PROXY_ERROR",

        message:
          error instanceof Error
            ? error.message
            : String(error || "Proxy request failed."),
      },
      500
    );
  }
}

// ============================================================
// JSON Response Helper
// ============================================================

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate",

        Pragma: "no-cache",
      },
    }
  );
}

// ============================================================
// Netlify Function Configuration
// ============================================================

export const config = {
  path: "/api",
};