export const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
