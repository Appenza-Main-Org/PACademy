/**
 * Exams / Question Bank API
 *   GET /api/questions?category=&difficulty=
 *   GET /api/exams
 *   POST /api/exams
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { Question } from '@/shared/types/domain';

export const examsService = {
  async listQuestions(filters: { category?: string; difficulty?: string } = {}): Promise<Question[]> {
    await simulateLatency();
    let items = MOCK.questions;
    if (filters.category && filters.category !== 'all') items = items.filter((q) => q.category === filters.category);
    if (filters.difficulty && filters.difficulty !== 'all') items = items.filter((q) => q.difficulty === filters.difficulty);
    return items;
  },
  async getCategories(): Promise<Array<{ name: string; count: number }>> {
    await simulateLatency();
    const counts = new Map<string, number>();
    for (const q of MOCK.questions) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  },
  async buildExam(opts: { count: number; durationMin: number }) {
    await simulateLatency();
    const shuffled = [...MOCK.questions].sort(() => Math.random() - 0.5);
    return {
      id: `EXAM-${Date.now()}`,
      questions: shuffled.slice(0, opts.count),
      duration: opts.durationMin,
      createdAt: Date.now(),
    };
  },
};
