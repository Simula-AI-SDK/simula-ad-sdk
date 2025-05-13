var env = process.env.NODE_ENV || "dev"
var API_URL = (env == "dev") ? "http://127.0.0.1:8000" : "https://simula-api-701226639755.us-central1.run.app/"

module.exports = { API_URL }