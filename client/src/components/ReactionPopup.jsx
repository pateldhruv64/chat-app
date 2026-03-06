const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const ReactionPopup = ({ onReact, onRemove, currentUserReaction, position = 'top' }) => {
    return (
        <div className={`reaction-popup ${position}`}>
            {REACTIONS.map((emoji) => (
                <button
                    key={emoji}
                    className={`reaction-option ${currentUserReaction === emoji ? 'active' : ''}`}
                    onClick={() => {
                        if (currentUserReaction === emoji) {
                            onRemove();
                        } else {
                            onReact(emoji);
                        }
                    }}
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
};

export default ReactionPopup;
