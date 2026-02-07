import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted">
          <div className="text-center">
            <h1 className="mb-4 text-4xl font-bold">Ошибка</h1>
            <p className="mb-4 text-xl text-muted-foreground">
              Что-то пошло не так
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="text-primary underline hover:text-primary/90"
              >
                Попробовать снова
              </button>
              <a
                href="/"
                className="text-primary underline hover:text-primary/90"
              >
                На главную
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
