import { useState, useEffect, useRef, useCallback } from "react";
import { useUpdateAnswer } from "./useAnswers";

interface AnswerState {
  selected_options: string[] | null;
  text_answer: string | null;
}

interface UseAutosaveProps {
  answers?: Array<{
    id: number;
    question: number;
    selected_options: string[] | null;
    text_answer: string | null;
  }>;
}

export function useAutosave({ answers }: UseAutosaveProps) {
  const updateAnswerMutation = useUpdateAnswer();
  const [localAnswers, setLocalAnswers] = useState<Record<number, AnswerState>>({});
  const [autosaveStatus, setAutosaveStatus] = useState<"saved" | "saving" | "error">("saved");

  const isInitializedRef = useRef(false);
  const debounceTimersRef = useRef<Record<number, any>>({});
  const pendingSaveRef = useRef<{ answerId: number; selected: string[] | null; text: string | null } | null>(null);

  // Initialize local answers state on load
  useEffect(() => {
    if (answers && !isInitializedRef.current) {
      const initialAnswers: Record<number, AnswerState> = {};
      answers.forEach((ans) => {
        initialAnswers[ans.id] = {
          selected_options: ans.selected_options,
          text_answer: ans.text_answer,
        };
      });
      setLocalAnswers(initialAnswers);
      isInitializedRef.current = true;
    }
  }, [answers]);

  const triggerAutosave = useCallback((answerId: number, selected: string[] | null, text: string | null) => {
    setAutosaveStatus("saving");

    if (debounceTimersRef.current[answerId]) {
      clearTimeout(debounceTimersRef.current[answerId]);
    }

    debounceTimersRef.current[answerId] = setTimeout(() => {
      updateAnswerMutation.mutate(
        {
          id: answerId,
          data: {
            selected_options: selected,
            text_answer: text,
          },
        },
        {
          onSuccess: () => {
            setAutosaveStatus("saved");
            if (pendingSaveRef.current?.answerId === answerId) {
              pendingSaveRef.current = null;
            }
          },
          onError: () => setAutosaveStatus("error"),
        }
      );
    }, 1200); // 1.2s debounce
  }, [updateAnswerMutation]);

  // Synchronous flush method for submission page callback
  const flushPendingSave = useCallback(async () => {
    if (!pendingSaveRef.current) return;

    const { answerId, selected, text } = pendingSaveRef.current;
    if (debounceTimersRef.current[answerId]) {
      clearTimeout(debounceTimersRef.current[answerId]);
    }

    setAutosaveStatus("saving");
    try {
      await updateAnswerMutation.mutateAsync({
        id: answerId,
        data: {
          selected_options: selected,
          text_answer: text,
        },
      });
      setAutosaveStatus("saved");
      pendingSaveRef.current = null;
    } catch (err) {
      setAutosaveStatus("error");
      throw err;
    }
  }, [updateAnswerMutation]);

  // Option select handler
  const selectOption = useCallback((answerId: number, optionId: string, isSingleChoice: boolean, currentAnswerState: AnswerState) => {
    let newSelected: string[] = [];
    if (isSingleChoice) {
      newSelected = [optionId];
    } else {
      const existing = currentAnswerState.selected_options || [];
      if (existing.includes(optionId)) {
        newSelected = existing.filter((x) => x !== optionId);
      } else {
        newSelected = [...existing, optionId];
      }
    }

    const updatedState = {
      ...currentAnswerState,
      selected_options: newSelected,
    };

    setLocalAnswers((prev) => ({
      ...prev,
      [answerId]: updatedState,
    }));

    pendingSaveRef.current = {
      answerId,
      selected: newSelected,
      text: currentAnswerState.text_answer,
    };

    triggerAutosave(answerId, newSelected, currentAnswerState.text_answer);
  }, [triggerAutosave]);

  // Text answer change handler
  const changeTextAnswer = useCallback((answerId: number, text: string, currentAnswerState: AnswerState) => {
    const updatedState = {
      ...currentAnswerState,
      text_answer: text,
    };

    setLocalAnswers((prev) => ({
      ...prev,
      [answerId]: updatedState,
    }));

    pendingSaveRef.current = {
      answerId,
      selected: currentAnswerState.selected_options,
      text,
    };

    triggerAutosave(answerId, currentAnswerState.selected_options, text);
  }, [triggerAutosave]);

  return {
    localAnswers,
    autosaveStatus,
    selectOption,
    changeTextAnswer,
    flushPendingSave,
    hasPendingSave: !!pendingSaveRef.current,
  };
}
