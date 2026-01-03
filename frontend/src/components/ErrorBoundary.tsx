'use client';

import React, { Component, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Result
            status="error"
            icon={<AlertCircle size={64} className="text-red-500" />}
            title="Something Went Wrong"
            subTitle={
              <div className="space-y-2">
                <p>An unexpected error occurred. Please try refreshing the page.</p>
                {this.state.error && (
                  <details className="text-left">
                    <summary className="cursor-pointer text-sm text-gray-600">
                      Error Details
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                      {this.state.error.toString()}
                    </pre>
                  </details>
                )}
              </div>
            }
            extra={[
              <Button type="primary" key="reset" onClick={this.handleReset}>
                Try Again
              </Button>,
              <Button key="home" onClick={() => (window.location.href = '/')}>
                Go Home
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
