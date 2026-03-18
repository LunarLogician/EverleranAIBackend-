# 🚨 IMMEDIATE ACTION PLAN

---

## 🔴 CRITICAL - FIX TODAY (1-2 hours)

### 1. **Generate Strong Random Secrets** (10 min)
Replace weak placeholders in `.env`:

```bash
# Generate new JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate new SESSION secret  
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

**Then update `.env`:**
```env
# OLD (WEAK):
JWT_SECRET=your_jwt_secret_key_here
SESSION_SECRET=your_session_secret_here

# NEW (STRONG):
JWT_SECRET=a3f8b2c9d4e1f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
SESSION_SECRET=9f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5
```

### 2. **Fix Token Usage Tracking** (30 min)

**Issue:** Claude API calls not deducting from user quota

**File:** `controllers/chatController.js` → Around line 102-136

**Current (WRONG):**
```javascript
const claudeResponse = await callClaude(...);
// ❌ Tokens received but never saved!
console.log(`Response tokens: input=${claudeResponse.inputTokens}, output=${claudeResponse.outputTokens}`);
```

**Fix (ADD THIS):**
```javascript
const claudeResponse = await callClaude(...);

// ✅ ADD: Track token usage
const tokensUsed = claudeResponse.inputTokens + claudeResponse.outputTokens;
await Usage.findOneAndUpdate(
  { userId },
  { $inc: { totalTokens: tokensUsed } }
);

console.log(`✅ Tokens used: ${tokensUsed} (User total: ${usage.totalTokens + tokensUsed})`);
```

**Apply to ALL controllers that call Claude:**
- [ ] chatController.js
- [ ] quizController.js
- [ ] flashcardController.js
- [ ] mcqController.js
- [ ] assignmentController.js

### 3. **Add Input Validation Middleware** (45 min)

**Create new file:** `middleware/validation.js`

```javascript
// middleware/validation.js
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error.details.map(d => d.message)
      });
    }
    req.validatedData = value;
    next();
  };
};

module.exports = validateRequest;
```

**Create validation schemas:** `validators/schemas.js`

```javascript
const Joi = require('joi');

exports.chatValidation = Joi.object({
  documentId: Joi.string().optional(),
  message: Joi.string().max(5000).optional(),
  image: Joi.string().optional(),
}).or('message', 'image');

exports.mcqValidation = Joi.object({
  sourceText: Joi.string().required().max(10000),
  title: Joi.string().optional().max(200),
  numQuestions: Joi.number().min(1).max(50).default(5),
});

// Add more schemas...
```

**Apply to routes:**
```javascript
// routes/chatRoutes.js
const validateRequest = require('../middleware/validation');
const { chatValidation } = require('../validators/schemas');

router.post('/', validateRequest(chatValidation), chatController.directChat);
```

---

## 🟡 IMPORTANT - FIX THIS WEEK (2-4 hours)

### 4. **Implement .gitignore** (5 min)

**Create/verify `.gitignore`:**
```gitignore
# Environment variables
.env
.env.local
.env.production
.env.*.local

# Node modules
node_modules/
npm-debug.log

# OS files
.DS_Store
Thumbs.db

# Uploads (temp files)
uploads/
*.tmp

# IDE
.vscode/
.idea/
*.swp

# Compiled output
dist/
build/

# Logs
*.log
logs/
```

**Verify .env not committed:**
```bash
git log --all --full-history -- .env
# Should show: "show [deleted]" or nothing
# If shows file contents with keys → **EMERGENCY: Rotate ALL credentials NOW**
```

### 5. **Fix Verbose Logging** (1 hour)

**Convert console.logs to debug mode:**

```javascript
// Before
console.log(`📁 Document ${document._id} uploaded...`);
console.log(`Message: "${message}"`);

// After
const debug = require('debug')('studentapp:documents');
debug(`Document ${document._id} uploaded...`);
// Don't log sensitive data in production

// Or use environment check:
if (process.env.NODE_ENV === 'development') {
  console.log(`📁 Document uploaded`); // No sensitive data
}
```

**Recommendation:** Use Winston logger
```bash
npm install winston
```

### 6. **Complete Payment Integration** (4-6 hours)

**Current Status:**
- ✅ Lemon Squeezy working
- ❌ PGTW placeholder only

**Options:**

**Option A: Only use Lemon Squeezy (SIMPLER)**
```javascript
// In subscriptionController.js
// Remove PGTW references
// Just use Lemon Squeezy API

// Results in:
// - Basic plan → Lemon Squeezy checkout
// - Pro plan → Lemon Squeezy checkout
```

**Option B: Add PGTW Integration**
```javascript
// Needs:
// 1. PGTW API documentation
// 2. Payment initiation endpoint
// 3. Payment callback/webhook
// 4. Signature verification

// Estimate: 4-6 hours development
```

**ACTION:** Clarify business requirement first!

### 7. **File Cleanup Guarantee** (30 min)

**Current:** Temp files might not delete

**File:** `controllers/documentController.js` → Line 72

**Fix:**
```javascript
// Instead of:
fs.unlink(req.file.path, (err) => {
  if (err) console.warn(`Warning: Could not delete temp file`);
});

// Use:
const fs = require('fs').promises;
try {
  await fs.unlink(req.file.path);
} catch (err) {
  console.warn(`Failed to delete temp file: ${req.file.path}`);
  // Maybe use rimraf as fallback
}
```

---

## 📋 TESTING CHECKLIST

### Before Committing Changes:

```bash
# 1. Test authentication
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Test rate limiting
for i in {1..1010}; do curl http://localhost:5000/health; done
# Should get 429 after 1000 requests

# 3. Test missing env vars (set NODE_ENV=production)
NODE_ENV=production npm start
# Should fail if JWT_SECRET missing

# 4. Test token tracking
# Call chat API, check Usage model incremented

# 5. Test input validation
curl -X POST http://localhost:5000/api/mcq/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"numQuestions":99999}'
# Should reject with validation error
```

---

## 📊 Verification Before Production

```markdown
- [ ] All API keys rotated
- [ ] JWT_SECRET is 64-char random string
- [ ] SESSION_SECRET is 64-char random string  
- [ ] .env is in .gitignore
- [ ] Token usage tracked for ALL Claude calls
- [ ] Input validation on ALL routes
- [ ] Payment integration complete OR removed
- [ ] Error logging configured (Sentry or similar)
- [ ] HTTPS configured
- [ ] CORS origin restricted (not *)
- [ ] Rate limiting: 1000 req/15min per-user
- [ ] Health check passes
- [ ] Database backups configured
- [ ] Logs rotated/archived
```

---

## 🆘 IF ALREADY COMPROMISED

**If .env was accidentally committed:**

```bash
# 1. IMMEDIATELY rotate ALL credentials
# - Change MongoDB password
# - Change all API keys
# - Generate new JWT/SESSION secrets
# - Change Google OAuth credentials (create new app)

# 2. Remove from git history
git filter-branch --tree-filter 'rm -f .env' HEAD

# 3. Force push (dangerous - notify team)
git push origin --force --all

# 4. Check if accessed
# - Monitor Claude API usage for suspicious calls
# - Check Cloudinary file access logs
# - Check email sending logs
```

---

## 📞 Quick Reference

### Commands to Run Now:

```bash
# 1. Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Verify .env not in git
git status | grep ".env"

# 3. Test server startup
NODE_ENV=development npm start

# 4. Test health endpoint
curl http://localhost:5000/health

# 5. Check rate limiting header
curl -i http://localhost:5000/health | grep -i "ratelimit"
```

### Files to Review/Update:

```
🔴 CRITICAL:
  - .env (rotate secrets)
  - .gitignore (verify)
  - controllers/chatController.js (add token tracking)
  - controllers/quizController.js (add token tracking)
  - controllers/flashcardController.js (add token tracking)
  - controllers/mcqController.js (add token tracking)

🟡 IMPORTANT:
  - middleware/validation.js (create)
  - validators/schemas.js (create)
  - routes/*.js (apply validation)
  - controllers/documentController.js (fix file cleanup)
  - servers.js (already fixed ✅)
```

---

## ⏱️ TIME ESTIMATES

| Task | Time | Priority |
|------|------|----------|
| Rotate secrets | 15 min | 🔴 NOW |
| Token tracking | 45 min | 🔴 NOW |
| Input validation | 1 hour | 🔴 NOW |
| Fix .gitignore | 5 min | 🔴 NOW |
| Fix logging | 1 hour | 🟡 Today |
| Payment integration | 6 hours | 🟡 This week |
| File cleanup | 30 min | 🟡 This week |
| Testing | 2 hours | 🟡 This week |
| **TOTAL** | **~17 hours** | - |

**Recommended Timeline:**
- **Today (2-3 hours):** Critical fixes
- **Tomorrow (3-4 hours):** Important fixes
- **This week (8 hours):** Complete testing

---

**Status:** 🟡 **Ready for Local Testing** (After critical fixes)  
**Status:** 🔴 **NOT Ready for Production** (Until all checklist items complete)

Next: Start with #1 (Rotate Secrets) - takes 15 minutes!
