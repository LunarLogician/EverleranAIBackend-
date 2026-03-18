# 📊 Backend Project Analysis Report

**Date:** March 18, 2026  
**Environment:** Development  
**Status:** 🟡 **FUNCTIONAL BUT NEEDS ATTENTION** (8 critical issues found)

---

## 🔴 CRITICAL ISSUES (Must Fix Before Deployment)

### 1. **SECURITY: API Keys Exposed in .env** ⚠️
**Severity:** CRITICAL  
**Files:** `.env`  
**Issue:**
- All API keys stored in plain .env file (Cloudinary, Brevo, Lemon Squeezy, Claude, Google OAuth)
- No encryption for sensitive data at rest
- If .env is committed to git, credentials are exposed
- Weak JWT secret: `your_jwt_secret_key_here`

**Risk:**
```
🟴 If .env is in git history, attackers can:
- Access MongoDB and delete/modify data
- Call Claude API and incur charges ($$$)
- Access Cloudinary and delete files
- Intercept authentication tokens (weak JWT)
```

**Evidence:**
```env
MONGODB_URI=mongodb+srv://zzubairahmed402:Pakistan123@...
JWT_SECRET=your_jwt_secret_key_here
SESSION_SECRET=your_session_secret_here
CLAUDE_API_KEY=sk-ant-api03-Y59OTjW7...
```

**Action Required:**
```bash
# 1. Verify .env is in .gitignore
cat .gitignore | grep ".env"

# 2. Rotate ALL credentials immediately:
#    - MongoDB password
#    - All API keys
#    - JWT/SESSION secrets

# 3. Generate strong random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 2. **Incomplete Payment Integration** ⚠️
**Severity:** CRITICAL  
**Files:** `controllers/subscriptionController.js` (line 59)  
**Issue:**
```javascript
// TODO: Integrate with PGTW/JazzCash payment gateway
// For now, return placeholder response
```

**Current Status:**
- ✅ Lemon Squeezy integration working (webhooks, checkout)
- ❌ Non-Lemon Squeezy payment gateway NOT implemented
- ❌ Basic/Pro plans CANNOT be purchased via normal payment flow
- ⚠️ Users can upgrade in database but payment is not verified

**Impact:**  
Paid plans won't generate revenue; users could bypass payment

**Fix Required:**
- Integrate with PGTW/JazzCash (Pakistani payment gateway)
- Or remove PGTW code if only using Lemon Squeezy

---

### 3. **Verbose Logging Could Expose Sensitive Data** ⚠️
**Severity:** HIGH  
**Files:** Multiple controllers (documentController, chatController, etc.)  
**Examples:**
```javascript
console.log(`📁 Document ${document._id} uploaded...`);  // Logs ALL documents
console.log(`Message: "${message}"`);                    // Could log PII
console.log(`🤖 Calling Claude with ${featureName}...`); // Detailed API calls
```

**Problem:**
- Logs include user IDs, file paths, message content
- In production, could expose PII (Personally Identifiable Information)
- Log files would be huge and slow

**Recommendation:**
- Remove or move to debug logging
- Use structured logging (Winston, Bunyan)
- Never log message content or PII

---

### 4. **Token Usage Not Properly Tracked** ⚠️
**Severity:** HIGH  
**Files:** `controllers/chatController.js`, `controllers/documentController.js`  
**Issue:**
- Claude API returns `inputTokens` and `outputTokens`
- Code receives but **NEVER saves to Usage model**
- Users have unlimited usage (not enforced)
- Can't bill accurately for paid plans

**Found:**
```javascript
const { callClaude } = require('../services/claudeService');
// Gets response with tokens but doesn't use them:
// { content: '...', inputTokens: 1234, outputTokens: 567 }
// ❌ No: await Usage.updateOne({ userId }, { $inc: { totalTokens: ... } })
```

**Test:**
```
1. User calls chat API
2. Claude processes 1000 tokens
3. Check Usage model → totalTokens NOT incremented
4. User can use unlimited tokens
```

---

### 5. **Missing Input Validation on Multiple Routes** ⚠️
**Severity:** MEDIUM  
**Files:** Multiple controllers  
**Examples:**
```javascript
// chatController.js - No validation on documentId
const { documentId, message, image } = req.body;
if ((!message || message.trim() === '') && !image) { // Only checks message

// mcqController.js - No validation on number range
const { sourceText, title, numQuestions = 5 } = req.body;
// numQuestions could be negative, 0, or 10000

// flashcardController.js - Similar issues
```

**Fix:** Add input validation middleware or validate in each controller

---

### 6. **Database Connection Not Verified on Startup** ⚠️
**Severity:** MEDIUM  
**Files:** `config/database.js`  
**Current Issue:**
```javascript
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
```

**Status:** ✅ FIXED in updated server.js (health check now verifies)

---

### 7. **File Upload Cleanup Not Guaranteed** ⚠️
**Severity:** MEDIUM  
**Files:** `controllers/documentController.js` (lines 70-76)  
**Issue:**
```javascript
.catch(err => console.error('Background extraction failed:', err))

// Cleanup attempt is non-blocking
fs.unlink(req.file.path, (err) => {
  if (err) console.warn(`Warning: Could not delete temp file: ${req.file.path}`);
  // If unlink fails, temp file stays on disk forever!
});
```

**Risk:**
- Temp files accumulate over time
- Could fill up disk and crash server
- No cleanup on extraction failure

**Fix:**
```javascript
// Use temp file cleanup library: tmp, rimraf
// Or delete in finally block
```

---

### 8. **Inconsistent Error Response Format** ⚠️
**Severity:** LOW-MEDIUM  
**Files:** Multiple files  
**Examples:**
```javascript
// Auth controller
res.status(400).json({ message: 'User already exists' });

// Document controller  
res.status(201).json({ success: true, message: '...', documentId: mcq._id });

// Chat controller
res.status(200).json({ success: true, response: '...', tokensCost: '...' });
```

**Issue:** No consistent response format across API

**Standardize to:**
```javascript
{
  success: true/false,
  status: 200,
  message: "...",
  data: { /* primary response data */ },
  error?: "...",
  timestamp: "...",
  trace?: "..." // dev only
}
```

---

## 🟡 MODERATE ISSUES (Should Fix Soon)

### A. **Cloudinary Not Actually Used**
- Configured but documents not uploaded to Cloudinary
- Files only stored as local files or in memory
- `uploadToCloudinary()` function exists but rarely called

### B. **Email Service Gracefully Fails**
- If BREVO_API_KEY not set, emails silently don't send
- Users won't know about verification issues
- Should warn or have fallback

**Current:**
```javascript
if (!apiKey) {
  console.warn('⚠️  BREVO_API_KEY not set — skipping email send');
  return null;
}
```

### C. **PDF Parsing Could Hang**
- Added 5-second timeout but could still block thread
- No queue system for processing
- Large PDFs might timeout

### D. **No Request Deduplication**
- User could spam same request → duplicate Claude calls
- No idempotency tokens
- Could incur unexpected charges

### E. **Missing Timestamp Normalization**
- Some models use `createdAt` auto-timestamp
- Some manually set timestamps
- Timezone handling inconsistent

---

## ✅ WHAT'S WORKING WELL

### Good Implementations:
1. ✅ **Authentication Flow** - Email/OTP + Google OAuth properly implemented
2. ✅ **Subscription Plans** - Free/Basic/Pro with token limits
3. ✅ **Lemon Squeezy Integration** - Webhook handling correct
4. ✅ **Multi-Format Document Support** - PDF, DOCX, PPTX extraction
5. ✅ **Rate Limiting** - Now fixed to 1000/15min per-user
6. ✅ **Error Handling Middleware** - Global error handler in place
7. ✅ **Graceful Shutdown** - SIGTERM/SIGINT handling added
8. ✅ **CORS Configuration** - Properly configured
9. ✅ **JWT Token Generation** - Standard implementation

---

## 📋 ENVIRONMENT VARIABLES ANALYSIS

### ✅ Set Correctly:
- `MONGODB_URI` - Valid Atlas connection
- `CLAUDE_API_KEY` - Valid Anthropic key
- `GOOGLE_CLIENT_ID/SECRET` - Valid OAuth credentials
- `BREVO_API_KEY` - Valid email service
- `CLOUDINARY_*` - Valid Cloudinary credentials
- `LEMONSQUEEZY_*` - Valid subscription service

### ⚠️ Security Concerns:
- `MONGODB_URI` contains username/password in plain text
- `JWT_SECRET` is placeholder: `your_jwt_secret_key_here`
- `SESSION_SECRET` is placeholder: `your_session_secret_here`
- All keys in one file with no encryption

### ❌ Not Set/Placeholder:
- `PAYMENT_GATEWAY_KEY=placeholder` - Not integrated
- `PAYMENT_GATEWAY_SECRET=placeholder` - Not integrated

**Recommendation:** Use secrets management:
- AWS Secrets Manager / Parameter Store
- HashiCorp Vault
- Azure Key Vault
- Or at minimum: `.env.example` without values + `.env` in gitignore

---

## 🧪 Testing Recommendations

### Unit Tests Missing:
```
❌ No tests for:
  - Authentication controllers
  - Token usage tracking
  - Payment validation
  - File extraction logic
  - OCR/PDF parsing
```

### Integration Tests Needed:
- [ ] Document upload → extraction → chunks
- [ ] Chat with document context
- [ ] Token usage tracking
- [ ] Subscription upgrade flow
- [ ] Payment webhook validation

### Load Testing:
- [ ] Rate limit behavior under load
- [ ] MongoDB connection pooling
- [ ] Claude API concurrent calls

### Security Testing:
- [ ] CORS bypass attempts
- [ ] JWT token forging
- [ ] SQL injection (if any)
- [ ] File upload vulnerability (malicious files)

---

## 🚀 Performance Considerations

### Current Issues:
1. **No Caching** - Same document text extracted multiple times
2. **No Query Optimization** - N+1 queries possible
3. **Synchronous File Operations** - Blocks event loop
4. **Large Chunks to Claude** - Uses 5000-char window (could be optimized)

### Bottlenecks:
- PDF parsing (5s timeout, single-threaded)
- Claude API calls (variable latency)
- Cloudinary uploads (network I/O)
- Email sending (blocking)

### Optimization Suggestions:
1. Add Redis caching for:
   - Document text (1 hour TTL)
   - User subscription info (5 min TTL)
   - Rate limit counters (existing)

2. Add request queuing for:
   - Document extraction
   - Claude API calls

3. Use Worker threads for:
   - PDF parsing
   - Text chunking

---

## 🔒 Security Audit Summary

| Category | Status | Notes |
|----------|--------|-------|
| API Keys | 🔴 Critical | Exposed in .env, weak JWT secret |
| Auth | ✅ Good | Proper JWT + OAuth |
| CORS | ✅ Good | Properly configured |
| Rate Limiting | ✅ Fixed | Now 1000/15min per-user |
| Input Validation | 🟡 Weak | Missing on some routes |
| Error Handling | ✅ Good | Global handler, no stack traces |
| Secrets Management | 🔴 None | Use vault/env service |
| HTTPS | ⚠️ Not Checked | Ensure in production |
| SQL Injection | ✅ Safe | Using Mongoose (ORM) |
| File Upload Validation | 🟡 Basic | Need MIME type + size checks |

---

## 📝 Checklist Before Production

- [ ] **CRITICAL**: Rotate all API keys and generate strong secrets
- [ ] **CRITICAL**: Remove .env from git history if committed
- [ ] **CRITICAL**: Implement token usage tracking
- [ ] **CRITICAL**: Complete payment gateway integration
- [ ] Add comprehensive input validation
- [ ] Set up error logging service (Sentry, etc.)
- [ ] Add structured logging (Winston)
- [ ] Implement request deduplication
- [ ] Add unit & integration tests
- [ ] Performance test document extraction
- [ ] Security audit of file uploads
- [ ] Database backup strategy
- [ ] CDN for static assets
- [ ] Configure environment-specific settings
- [ ] Document all API endpoints
- [ ] Add API request/response validation

---

## 🎯 Priority Action Items

### 🔴 DO IMMEDIATELY (Before Any Deployment):
1. Rotate all API credentials
2. Generate strong random JWT/SESSION secrets
3. Implement token usage tracking
4. Add input validation middleware
5. Commit .env to .gitignore

### 🟡 DO SOON (This Week):
1. Implement payment gateway integration
2. Remove verbose logging
3. Add error logging service
4. Implement file cleanup
5. Add request validation

### 🟢 DO LATER (Next Sprint):
1. Add unit/integration tests
2. Performance optimization
3. Database indexing
4. Caching layer
5. API documentation

---

## 📊 Code Quality Metrics

```
Lines of Code:        ~2500
Controllers:          8 files ✅
Models:               9 files ✅
Routes:               8 files ✅
Middleware:           3 files ✅
Services:             2 files ✅
Error Handling:       ✅ Global handler
Logging:              🟡 Verbose, needs cleanup
Testing:              ❌ None
Documentation:        ⚠️ Minimal
```

---

## 💡 Next Steps

1. **Fix Critical Security Issues** (30 min)
   - Generate new secrets
   - Update .env template

2. **Implement Token Tracking** (2 hours)
   - Modify Claude service calls
   - Update Usage model

3. **Add Input Validation** (1.5 hours)
   - Create validation middleware
   - Apply to all routes

4. **Complete Payment Integration** (4-6 hours)
   - Either integrate PGTW or remove
   - Add payment verification

5. **Testing & Deployment** (ongoing)
   - Add tests
   - Load test
   - Security audit

**Estimated time to production-ready: 3-4 days**
