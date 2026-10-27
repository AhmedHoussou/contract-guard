import * as http from 'http';
export function startMockServer(port = 4000) {
    const users = [
        {
            id: 1,
            fullName: 'Sarah Connor',
            email: 'sarah@example.com',
            createdAt: new Date().toISOString(),
        },
    ];
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${port}`);
        // Route: GET /api/v1/users
        if (req.method === 'GET' && url.pathname === '/api/v1/users') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(users));
            return;
        }
        // Route: POST /api/v1/users
        if (req.method === 'POST' && url.pathname === '/api/v1/users') {
            let bodyText = '';
            for await (const chunk of req) {
                bodyText += chunk;
            }
            let payload = {};
            try {
                payload = JSON.parse(bodyText);
            }
            catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Malformed JSON', code: 'INVALID_JSON' }));
                return;
            }
            // 1. Missing required field checks
            if (!payload.name || !payload.email || !payload.role) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields', code: 'MISSING_FIELDS' }));
                return;
            }
            // 2. Type validation
            if (typeof payload.name !== 'string' || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data types', code: 'TYPE_ERROR' }));
                return;
            }
            // 3. minLength boundary
            if (payload.name.length < 2) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Name must be at least 2 chars', code: 'BOUNDARY_ERROR' }));
                return;
            }
            // 4. Enum validation
            if (!['admin', 'member', 'guest'].includes(payload.role)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid role', code: 'ENUM_ERROR' }));
                return;
            }
            // 5. Numeric boundary validation
            if (payload.age !== undefined && (typeof payload.age !== 'number' || payload.age < 18)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Age must be >= 18', code: 'AGE_BOUNDARY_ERROR' }));
                return;
            }
            // Happy path creation: return compliant UserResponse schema
            const newUser = {
                id: users.length + 1,
                name: payload.name,
                email: payload.email,
                role: payload.role,
                createdAt: new Date().toISOString(),
            };
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(newUser));
            return;
        }
        // Default 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }));
    });
    server.listen(port, () => {
        console.log(`[Mock Server] Running on http://localhost:${port}`);
    });
    return server;
}
// Standalone execution
if (process.argv[1] && process.argv[1].endsWith('mock-server.ts')) {
    startMockServer(4000);
}
