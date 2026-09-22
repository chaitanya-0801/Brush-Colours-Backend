import mongoose from "mongoose";

const passwordTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400,
    },
  },
  { timestamps: true },
);

const passwordTokenModel = mongoose.model("passwordToken", passwordTokenSchema);

export default passwordTokenModel;
