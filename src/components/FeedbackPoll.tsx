import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, MessageCircle } from 'lucide-react';

interface FeedbackPollProps {
  onFeedback: (rating: 'positive' | 'negative') => void;
  onSkip?: () => void;
  isVisible: boolean;
}

const FeedbackPoll: React.FC<FeedbackPollProps> = ({ onFeedback, onSkip, isVisible }) => {
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = (rating: 'positive' | 'negative') => {
    setSubmitted(true);
    onFeedback(rating);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">How was your chat experience?</CardTitle>
          <p className="text-muted-foreground text-sm">
            Your feedback helps us improve Ceople for everyone
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!submitted ? (
            <>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleFeedback('positive')}
                  className="flex flex-col items-center gap-2 h-20 w-20 rounded-full"
                >
                  <ThumbsUp className="h-6 w-6 text-green-600" />
                  <span className="text-xs">Good</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleFeedback('negative')}
                  className="flex flex-col items-center gap-2 h-20 w-20 rounded-full"
                >
                  <ThumbsDown className="h-6 w-6 text-red-600" />
                  <span className="text-xs">Bad</span>
                </Button>
              </div>
              {onSkip && (
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="w-full"
                >
                  Skip
                </Button>
              )}
            </>
          ) : (
            <div className="text-center space-y-2">
              <MessageCircle className="h-8 w-8 text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">
                Thank you for your feedback!
              </p>
              {onSkip && (
                <Button
                  variant="outline"
                  onClick={onSkip}
                  className="mt-2"
                >
                  Continue
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackPoll;
