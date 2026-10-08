/* ============================================================
   NETLIFY API BRIDGE
   Temporary architecture:
   Netlify React -> Netlify Function -> Apps Script -> Sheets
   ============================================================ */

const NETLIFY_API_SECRET_PROPERTY = 'NETLIFY_API_SECRET';

function doPost(e) {
  try {
    const body = parseNetlifyJson_(e);
    authorizeNetlifyApi_(body);

    const action = String(body.action || '').trim();

    switch (action) {
      case 'health':
        return jsonOutput_({
          success: true,
          service: APP.NAME,
          version: APP.VERSION,
          timestamp: new Date().toISOString()
        });

      case 'bootstrap':
        return jsonOutput_(bootstrap());

      case 'list':
        return jsonOutput_(
          apiListModule(
            String(body.module || ''),
            body.filters || {}
          )
        );

      case 'record':
        return jsonOutput_(
          apiGetRecord(
            String(body.module || ''),
            String(body.id || '')
          )
        );

      case 'create':
        return jsonOutput_(
          createRecord(
            String(body.module || ''),
            body.data || {},
            body.files || []
          )
        );

      case 'update':
        return jsonOutput_(
          updateRecord(
            String(body.module || ''),
            String(body.id || ''),
            body.data || {}
          )
        );

      case 'dashboard':
        return jsonOutput_(apiDashboard());

      case 'project-detail':
        return jsonOutput_(
          getProjectDetail(String(body.id || ''))
        );

      case 'contract-detail':
        return jsonOutput_(
          getContractDetail(String(body.contractNo || ''))
        );

      case 'search':
        return jsonOutput_(
          searchAll(String(body.q || ''))
        );

      case 'data-quality':
        return jsonOutput_(runDataQuality());

      default:
        return jsonOutput_({
          success: false,
          errorCode: 'INVALID_ACTION',
          message: 'Unsupported API action.'
        });
    }

  } catch (err) {
    return jsonOutput_({
      success: false,
      errorCode: 'API_ERROR',
      message: safeNetlifyError_(err)
    });
  }
}

function parseNetlifyJson_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('Invalid JSON request.');
  }
}

function authorizeNetlifyApi_(body) {
  const configured = String(
    PropertiesService
      .getScriptProperties()
      .getProperty(NETLIFY_API_SECRET_PROPERTY) || ''
  ).trim();

  if (!configured) {
    throw new Error('NETLIFY_API_SECRET is not configured.');
  }

  const supplied = String(body.apiSecret || '').trim();

  if (!supplied || supplied !== configured) {
    throw new Error('Unauthorized API request.');
  }
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeNetlifyError_(err) {
  return String(
    err && err.message
      ? err.message
      : err || 'Unknown server error.'
  );
}