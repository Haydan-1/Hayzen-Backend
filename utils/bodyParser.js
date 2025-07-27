// utils/bodyParser.js

async function bodyParser(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                const parsed = JSON.parse(body);
                resolve(parsed);
            } catch (error) {
                reject("❌ Invalid JSON in request body.");
            }
        });

        req.on("error", (err) => {
            reject("❌ Error reading request body.");
        });
    });
}

module.exports = bodyParser;
