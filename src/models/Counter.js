const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },   // e.g. "doctorId"
  seq: { type: Number, default: 0 },
});

// Check if model exists before creating a new one
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

module.exports = Counter;
