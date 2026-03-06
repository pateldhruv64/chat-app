import { useState, useEffect, useRef } from 'react';

const EMOJI_CATEGORIES = {
    'Recently Used': [],
    '😊 Smileys': [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
        '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋',
        '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡',
        '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬',
        '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
        '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
        '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯',
        '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢',
        '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤',
        '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
    ],
    '❤️ Hearts': [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
        '💟', '♥️', '💋', '👄', '🫦', '💏', '💑', '🥂', '🌹', '🎀',
    ],
    '👋 Gestures': [
        '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌',
        '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉',
        '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛',
        '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
    ],
    '🐶 Animals': [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
        '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
        '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
        '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰',
    ],
    '🍕 Food': [
        '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
        '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
        '🫛', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄',
        '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆',
        '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🍸',
    ],
    '⚽ Activities': [
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
        '🪀', '🏓', '🏸', '🏒', '🥅', '⛳', '🪃', '🏹', '🎣', '🤿',
        '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️',
        '🎯', '🪁', '🎮', '🕹️', '🎲', '🧩', '♟️', '🎭', '🎨', '🎪',
    ],
    '🌍 Travel': [
        '🚗', '🚕', '🚙', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚',
        '✈️', '🚀', '🛸', '🚁', '⛵', '🚢', '🏠', '🏡', '🏢', '🏰',
        '🗼', '🗽', '⛪', '🕌', '🛕', '🌋', '🏔️', '⛰️', '🏕️', '🏖️',
        '🌅', '🌄', '🌠', '🎇', '🎆', '🌈', '🌊', '🗻', '🌍', '🌎',
    ],
    '💡 Objects': [
        '⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️',
        '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '🔍',
        '💡', '🔦', '🏮', '🪔', '📔', '📕', '📖', '📗', '📘', '📙',
        '🎵', '🎶', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸',
        '🔔', '🔕', '📣', '📢', '💎', '🔑', '🗝️', '🔐', '🔒', '🔓',
    ],
};

const STORAGE_KEY = 'chatapp_recent_emojis';
const MAX_RECENT = 16;

const EmojiPicker = ({ onSelect, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('😊 Smileys');
    const [recentEmojis, setRecentEmojis] = useState([]);
    const pickerRef = useRef(null);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setRecentEmojis(JSON.parse(saved));
            } catch (e) {
                setRecentEmojis([]);
            }
        }
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleSelect = (emoji) => {
        // Update recent emojis
        const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
        setRecentEmojis(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        onSelect(emoji);
    };

    const categoryKeys = Object.keys(EMOJI_CATEGORIES);
    const currentEmojis = activeCategory === 'Recently Used'
        ? recentEmojis
        : EMOJI_CATEGORIES[activeCategory] || [];

    return (
        <div className="emoji-picker" ref={pickerRef}>
            <div className="emoji-picker-tabs">
                {recentEmojis.length > 0 && (
                    <button
                        className={`emoji-tab ${activeCategory === 'Recently Used' ? 'active' : ''}`}
                        onClick={() => setActiveCategory('Recently Used')}
                        title="Recently Used"
                    >
                        🕐
                    </button>
                )}
                {categoryKeys.filter((k) => k !== 'Recently Used').map((cat) => (
                    <button
                        key={cat}
                        className={`emoji-tab ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat)}
                        title={cat}
                    >
                        {cat.split(' ')[0]}
                    </button>
                ))}
            </div>
            <div className="emoji-grid">
                {currentEmojis.length === 0 ? (
                    <div className="emoji-empty">No recent emojis yet</div>
                ) : (
                    currentEmojis.map((emoji, i) => (
                        <button
                            key={`${emoji}-${i}`}
                            className="emoji-item"
                            onClick={() => handleSelect(emoji)}
                        >
                            {emoji}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

export default EmojiPicker;
