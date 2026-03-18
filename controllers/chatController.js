const Chat = require('../models/Chat');
const Document = require('../models/Document');
const Usage = require('../models/Usage');
const { callClaude } = require('../services/claudeService');

// Direct chat - with or without document (flexible mode)
exports.directChat = async (req, res, next) => {
  try {
    const { documentId, message, image } = req.body;
    const userId = req.user._id;

    console.log(`\n🔵 [directChat] Request received`);
    console.log(`   Message: "${message}"`);
    console.log(`   DocumentID: ${documentId}`);
    console.log(`   HasImage: ${!!image}`);
    console.log(`   UserID: ${userId}`);

    if ((!message || message.trim() === '') && !image) {
      return res.status(400).json({ message: 'Message or image is required' });
    }

    // Parse image if provided — extract media type and raw base64 data
    let imageContentBlock = null;
    if (image) {
      const matches = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/s);
      if (!matches) {
        return res.status(400).json({ message: 'Invalid image format. Must be a base64 data URL.' });
      }
      imageContentBlock = {
        type: 'image',
        source: { type: 'base64', media_type: matches[1], data: matches[2] },
      };
      console.log(`   🖼️  Image media type: ${matches[1]}`);
    }

    const messageText = (message && message.trim()) || 'What do you see in this image?';

    // Helper: build content as array (text + image) or plain string
    const buildContent = (text) => {
      if (imageContentBlock) {
        return [imageContentBlock, { type: 'text', text }];
      }
      return text;
    };

    let claudeMessages;
    let featureName = 'genericChat';  // Default feature tracking

    // MODE 1: Chat WITH document context
    if (documentId) {
      console.log(`\n📄 [directChat] Document ID provided: ${documentId}`);
      // Verify document ownership
      const document = await Document.findById(documentId);
      console.log(`   Document found: ${!!document}`);
      console.log(`   Document data:`, JSON.stringify({
        id: document?._id,
        title: document?.title,
        processingStatus: document?.processingStatus,
        textContentLength: document?.textContent?.length || 0,
        textContentPreview: document?.textContent?.substring(0, 100) || 'NULL',
        chunkCount: document?.chunkCount
      }, null, 2));

      if (!document || document.userId.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'Unauthorized access to document' });
      }

      // Check if document extraction is complete
      if (document.processingStatus !== 'completed') {
        console.log(`   ❌ Document not ready. Status: ${document.processingStatus}`);
        return res.status(400).json({
          message: 'Document text is still being extracted. Please wait...',
          status: document.processingStatus
        });
      }

      if (!document.textContent) {
        console.log(`   ❌ TextContent is empty/null`);
        return res.status(400).json({ message: 'Document text content not available' });
      }

      console.log(`   ✅ Document ready with ${document.textContent.length} chars of text`);
      featureName = 'docQA';

      // Use only first 5000 chars to speed up Claude calls (reduce latency)
      const contextWindow = document.textContent.substring(0, 5000);

      // Prepare Claude prompt with document context (+ optional image)
      const docText = `You are a helpful study assistant. Answer questions about the following document:\n\n${contextWindow}\n\nUser's question: ${messageText}`;
      claudeMessages = [{ role: 'user', content: buildContent(docText) }];

    } else {
      // MODE 2: Generic chat WITHOUT document (ChatGPT-like)
      console.log(`\n💬 [directChat] Generic mode (no document)`);
      const genericText = imageContentBlock
        ? `You are a helpful study assistant. ${messageText}`
        : `You are a helpful study assistant. Answer the following question:\n\n${messageText}`;
      claudeMessages = [{ role: 'user', content: buildContent(genericText) }];
    }

    // Call Claude API
    console.log(`\n🤖 [directChat] Calling Claude with ${featureName} mode...`);
    const claudeResponse = await callClaude(claudeMessages, 'qa', 1024);
    console.log(`   Response tokens: input=${claudeResponse.inputTokens}, output=${claudeResponse.outputTokens}`);

    // Update usage
    const usage = await Usage.findOne({ userId });
    if (usage) {
      usage.inputTokens += claudeResponse.inputTokens;
      usage.outputTokens += claudeResponse.outputTokens;
      usage.totalTokens = usage.inputTokens + usage.outputTokens;

      // Track feature usage
      const featureUsage = usage.usageBreakdown.find((u) => u.featureName === featureName);
      if (featureUsage) {
        featureUsage.inputTokens += claudeResponse.inputTokens;
        featureUsage.outputTokens += claudeResponse.outputTokens;
        featureUsage.count += 1;
      } else {
        usage.usageBreakdown.push({
          featureName: featureName,
          inputTokens: claudeResponse.inputTokens,
          outputTokens: claudeResponse.outputTokens,
          count: 1,
        });
      }

      await usage.save();
    }

    // Get updated chat count to return to client
    const updatedUsage = await Usage.findOne({ userId });
    const genericEntry = updatedUsage?.usageBreakdown.find((u) => u.featureName === featureName);
    const chatCount = genericEntry?.count || 1;

    console.log(`\n✅ [directChat] Success! Returning response with ${featureName} mode\n`);

    // Persist messages to Chat history for both generic and document chats
    {
      const query = documentId ? { userId, documentId } : { userId, documentId: null };
      let chat = await Chat.findOne(query).sort({ updatedAt: -1 });
      if (!chat) {
        const title = documentId
          ? (await Document.findById(documentId))?.title || 'Document Chat'
          : 'General Chat';
        chat = new Chat({ userId, documentId: documentId || null, title, messages: [] });
      }
      chat.messages.push(
        { role: 'user', content: messageText, image: image || null, timestamp: new Date() },
        { role: 'assistant', content: claudeResponse.content, timestamp: new Date() }
      );
      await chat.save();
    }

    res.status(200).json({
      success: true,
      message: {
        role: 'assistant',
        content: claudeResponse.content,
      },
      mode: documentId ? 'document' : 'generic',
      tokensUsed: {
        input: claudeResponse.inputTokens,
        output: claudeResponse.outputTokens,
      },
      chatCount,
    });
  } catch (error) {
    console.error(`\n❌ [directChat] Error:`, error.message);
    next(error);
  }
};

// Get chat count for the authenticated user
exports.getChatCount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const usage = await Usage.findOne({ userId });
    const genericEntry = usage?.usageBreakdown.find((u) => u.featureName === 'genericChat');
    const count = genericEntry?.count || 0;
    res.status(200).json({ success: true, count });
  } catch (error) {
    next(error);
  }
};

// Create or fetch chat for document
exports.createChat = async (req, res, next) => {
  try {
    const { documentId, title } = req.body;
    const userId = req.user._id;

    // Verify document ownership
    const document = await Document.findById(documentId);
    if (!document || document.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to document' });
    }

    const chat = new Chat({
      userId,
      documentId,
      title: title || 'New Chat',
      messages: [],
    });

    await chat.save();

    res.status(201).json({
      success: true,
      chat: {
        id: chat._id,
        title: chat.title,
        documentId: chat.documentId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Send message in chat
exports.sendMessage = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || chat.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    // Add user message
    chat.messages.push({
      role: 'user',
      content: message,
    });

    // Get document context
    const document = await Document.findById(chat.documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.processingStatus !== 'completed') {
      return res.status(400).json({ 
        message: 'Document is still processing. Please wait before asking questions.',
        processingStatus: document.processingStatus
      });
    }

    const documentContext = document.textContent || '[Document content not available]';
    
    if (!document.textContent) {
      return res.status(400).json({ message: 'Document text content not available' });
    }

    // Prepare messages for Claude
    const claudeMessages = [
      {
        role: 'user',
        content: `You are a helpful study assistant. Answer questions about the following document:\n\n${documentContext}\n\nUser's question: ${message}`,
      },
    ];

    // Call Claude API
    const claudeResponse = await callClaude(claudeMessages, 'qa', 1024);

    // Add assistant response
    chat.messages.push({
      role: 'assistant',
      content: claudeResponse.content,
    });

    // Update usage
    const usage = await Usage.findOne({ userId });
    if (usage) {
      usage.inputTokens += claudeResponse.inputTokens;
      usage.outputTokens += claudeResponse.outputTokens;
      usage.totalTokens = usage.inputTokens + usage.outputTokens;

      // Track feature usage
      const featureUsage = usage.usageBreakdown.find((u) => u.featureName === 'docQA');
      if (featureUsage) {
        featureUsage.inputTokens += claudeResponse.inputTokens;
        featureUsage.outputTokens += claudeResponse.outputTokens;
        featureUsage.count += 1;
      } else {
        usage.usageBreakdown.push({
          featureName: 'docQA',
          inputTokens: claudeResponse.inputTokens,
          outputTokens: claudeResponse.outputTokens,
          count: 1,
        });
      }

      await usage.save();
    }

    await chat.save();

    res.status(200).json({
      success: true,
      message: {
        role: 'assistant',
        content: claudeResponse.content,
      },
      tokensUsed: {
        input: claudeResponse.inputTokens,
        output: claudeResponse.outputTokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all chat history for current user
exports.getHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({ userId }).sort({ createdAt: -1 });

    // Format response to match frontend expectations
    const messages = chats.reduce((acc, chat) => {
      return acc.concat(chat.messages);
    }, []);

    res.status(200).json({
      success: true,
      data: messages,
      chats: chats,
    });
  } catch (error) {
    next(error);
  }
};

// Get chat history
exports.getChatHistory = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);

    if (!chat || chat.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    res.status(200).json({
      success: true,
      chat,
    });
  } catch (error) {
    next(error);
  }
};

// Generate summary
exports.generateSummary = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const userId = req.user._id;

    const document = await Document.findById(documentId);
    if (!document || document.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const claudeMessages = [
      {
        role: 'user',
        content: `Create a concise 60-page summary of the following document:\n\n${document.textContent}`,
      },
    ];

    const claudeResponse = await callClaude(claudeMessages, 'summary', 2048);

    // Update usage
    const usage = await Usage.findOne({ userId });
    if (usage) {
      usage.outputTokens += claudeResponse.outputTokens;
      usage.totalTokens = usage.inputTokens + usage.outputTokens;

      const featureUsage = usage.usageBreakdown.find((u) => u.featureName === 'summaryGeneration');
      if (featureUsage) {
        featureUsage.outputTokens += claudeResponse.outputTokens;
        featureUsage.count += 1;
      } else {
        usage.usageBreakdown.push({
          featureName: 'summaryGeneration',
          inputTokens: claudeResponse.inputTokens,
          outputTokens: claudeResponse.outputTokens,
          count: 1,
        });
      }

      await usage.save();
    }

    res.status(200).json({
      success: true,
      summary: claudeResponse.content,
      tokensUsed: {
        input: claudeResponse.inputTokens,
        output: claudeResponse.outputTokens,
      },
    });
  } catch (error) {
    next(error);
  }
};
