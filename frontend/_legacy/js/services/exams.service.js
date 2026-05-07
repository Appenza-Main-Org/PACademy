/**
 * Exams Service (Question Bank + Electronic Exams)
 * Endpoints: /api/questions, /api/exams, /api/exams/:id/results
 */
(function() {
  'use strict';
  const delay = (ms = 150) => new Promise(r => setTimeout(r, ms));
  async function listQuestions(filters = {}) {
    await delay();
    let q = [...window.MockData.questions];
    if (filters.category) q = q.filter(x => x.category === filters.category);
    if (filters.difficulty) q = q.filter(x => x.difficulty === filters.difficulty);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      q = q.filter(x => x.text.toLowerCase().includes(s));
    }
    return q;
  }
  async function getCategories() {
    await delay();
    const counts = {};
    window.MockData.questions.forEach(q => {
      counts[q.category] = (counts[q.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }
  async function buildExam(opts) {
    await delay(300);
    return {
      id: `EX-${Date.now()}`,
      questions: window.MockData.questions.slice(0, opts.count || 10),
      duration: opts.duration || 30,
      createdAt: Date.now(),
    };
  }
  window.ExamsService = { listQuestions, getCategories, buildExam };
})();
