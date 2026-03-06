import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';

const generateUniqueId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 8);

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    uniqueId: {
        type: String,
        unique: true,
        index: true,
    },
    displayName: {
        type: String,
        default: '',
    },
    bio: {
        type: String,
        default: '',
        maxlength: 200,
    },
    avatar: {
        type: String,
        default: '',
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true,
    },
    age: {
        type: Number,
        required: true,
        min: 13,
    },
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    blocked: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    isOnline: {
        type: Boolean,
        default: false,
    },
    isHidden: {
        type: Boolean,
        default: false,
    },
    lastSeen: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Generate unique alphanumeric ID before save
userSchema.pre('save', async function (next) {
    if (this.uniqueId) return next();
    let id;
    let exists = true;
    while (exists) {
        id = generateUniqueId();
        exists = await mongoose.models.User.findOne({ uniqueId: id });
    }
    this.uniqueId = id;
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
