import http from "node:http";

const port = Number(process.env.BESA_E2E_DEPLOY_STUB_PORT ?? "4022");
let retryCount = 0;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function normalizeDeploymentUrl(hostname) {
  return hostname.startsWith("http") ? hostname : `https://${hostname}`;
}

function createDeploymentPayload(id, readyState, url, inspectorUrl) {
  return {
    id,
    readyState,
    url,
    inspectorUrl,
  };
}

function inspectPayloadForId(id) {
  if (id === "dpl_phase34_attempt1") {
    return createDeploymentPayload(
      id,
      "READY",
      "phase34-attempt1-ready.vercel.app",
      "https://vercel.example/dpl_phase34_attempt1",
    );
  }

  if (id === "dpl_phase34_attempt2") {
    return createDeploymentPayload(
      id,
      "READY",
      "phase34-ready.vercel.app",
      "https://vercel.example/dpl_phase34_attempt2",
    );
  }

  if (id.startsWith("dpl_phase45_retry_")) {
    return createDeploymentPayload(
      id,
      "BUILDING",
      `${id}.vercel.app`,
      `https://vercel.example/${id}`,
    );
  }

  return createDeploymentPayload(
    id,
    "BUILDING",
    `${id}.vercel.app`,
    `https://vercel.example/${id}`,
  );
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v13/deployments") {
    retryCount += 1;
    const deploymentId = `dpl_phase45_retry_${retryCount}`;
    const payload = createDeploymentPayload(
      deploymentId,
      "BUILDING",
      `${deploymentId}.vercel.app`,
      `https://vercel.example/${deploymentId}`,
    );
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/v13/deployments/")) {
    const deploymentId = url.pathname.split("/").pop() ?? "";
    const payload = inspectPayloadForId(deploymentId);
    sendJson(response, 200, payload);
    return;
  }

  sendJson(response, 404, {
    error: {
      message: "Not found",
    },
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Phase 45 deploy execution stub listening on http://127.0.0.1:${port}`);
});
