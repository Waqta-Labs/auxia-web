import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeManualPriorityUseCase } from '../../infrastructure/container.js';

export function useRemoveManualPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zoneId) => removeManualPriorityUseCase.execute(zoneId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
