const ChatHistory = require('../models/ChatHistory');
const { ai, chatConfig } = require('../config/gemini');
const { callChatWithFallback } = require('../utils/aiWithFallback');

const sendMessage = async (req, res) => {
  try {
    const { message, chatId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a message'
      });
    }

    let chat;

    if (chatId) {
      chat = await ChatHistory.findOne({
        _id: chatId,
        user: req.user._id
      });

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
    } else {
      chat = await ChatHistory.create({
        user: req.user._id,
        title: message.slice(0, 50),
        messages: []
      });
    }

    const history = chat.messages.map((msg) => [
      {
        role: 'user',
        parts: [{ text: msg.userMessage }]
      },
      {
        role: 'model',
        parts: [{ text: msg.aiResponse }]
      }
    ]).flat();

    const response = await callChatWithFallback(
      ai,
      chatConfig,
      history,
      message
    );

    console.log(`Chat by: ${response.provider} on attempt: ${response.attempt}`);

    const aiReply = response.text;

    chat.messages.push({
      userMessage: message,
      userId: req.user._id,
      aiResponse: aiReply
    });

    await chat.save();

    res.json({
      success: true,
      chatId: chat._id,
      provider: response.provider,
      message: {
        userMessage: message,
        userId: req.user._id,
        aiResponse: aiReply
      }
    });

  } catch (error) {
    if (error.message.includes('All 5 attempts failed')) {
      return res.status(429).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending message'
    });
  }
};

// get all chats
const getChats = async (req, res) => {
  try {
    const chats = await ChatHistory.find({ user: req.user._id })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: chats.length,
      chats
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chats'
    });
  }
};

// getChat by id
const getChat = async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await ChatHistory.findOne({
      _id: id,
      user: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chat'
    });
  }
};

// delete chat
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await ChatHistory.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting chat'
    });
  }
};

// clear chat
const clearChat = async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await ChatHistory.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { messages: [] },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      message: 'Chat cleared successfully'
    });
  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error clearing chat'
    });
  }
};

module.exports = { sendMessage, getChats, getChat, deleteChat, clearChat };