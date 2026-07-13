const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getChats,
  getChat,
  deleteChat,
  clearChat
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.post('/message', protect, sendMessage);      
router.get('/', protect, getChats);               
router.get('/:id', protect, getChat);            
router.delete('/:id', protect, deleteChat);        
router.patch('/:id/clear', protect, clearChat);  

module.exports = router;