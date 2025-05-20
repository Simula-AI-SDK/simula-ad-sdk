var env = process.env.NODE_ENV || "prod"
var API_URL = (env == "dev") ? "http://127.0.0.1:8000" : "https://simula-api-701226639755.us-central1.run.app/"

// ES module exports
export { API_URL }; 