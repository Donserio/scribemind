import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import generateHandler from './api/generate.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Assign keys to process.env so the generateHandler can read them
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (env.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;
  if (env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'api-generate-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/generate' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  const parsedBody = JSON.parse(body);
                  const mockReq = {
                    method: req.method,
                    body: parsedBody,
                    headers: req.headers
                  };
                  
                  const mockRes = {
                    statusCode: 200,
                    headers: {},
                    setHeader(name, value) {
                      this.headers[name] = value;
                      return this;
                    },
                    status(code) {
                      this.statusCode = code;
                      return this;
                    },
                    json(data) {
                      res.writeHead(this.statusCode, {
                        'Content-Type': 'application/json',
                        ...this.headers
                      });
                      res.end(JSON.stringify(data));
                    },
                    end(data) {
                      res.writeHead(this.statusCode, this.headers);
                      res.end(data);
                    }
                  };
                  
                  await generateHandler(mockReq, mockRes);
                } catch (err) {
                  console.error("Vite API mock error:", err);
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }
            next();
          });
        }
      }
    ]
  }
})
