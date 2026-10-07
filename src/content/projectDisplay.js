/** Unfilled CMS entries remain clearly labelled instead of inventing projects. */
export const projectTitle = (project, index) => project.title?.startsWith('[')
  ? `Project ${String(index + 1).padStart(2, '0')}` : project.title;
export const projectPending = project => !project.title || project.title.startsWith('[');
