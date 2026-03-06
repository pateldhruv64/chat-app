import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh', gap: '16px',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                }}>
                    <span style={{ fontSize: '3rem' }}>😵</span>
                    <h2>Something went wrong</h2>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
                    >
                        Go Home
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
