type AdminCandidate = {
  email?: string | null;
  app_metadata?: object;
} | null | undefined;

export function isAdminUser(user: AdminCandidate): boolean {
  return user?.email?.trim().toLowerCase() === 'admin@lacasitagamer.com'
    || (
      typeof user?.app_metadata === 'object'
      && user.app_metadata !== null
      && 'role' in user.app_metadata
      && user.app_metadata.role === 'admin'
    );
}
