import mongoose from 'mongoose';

const translationSchema = new mongoose.Schema({
  ar: { type: String, required: false },
  en: { type: String, required: false },
  fr: { type: String, required: false }
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  title: translationSchema,
  message: translationSchema,
  type: { type: String },
  timestamp: { type: Date, default: Date.now },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  read: { type: Boolean, default: false }
});

export default mongoose.model('Notification', notificationSchema);