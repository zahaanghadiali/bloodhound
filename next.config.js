/** @type {import('next').NextConfig} */
const nextConfig = {
  // all-the-cities reads a binary asset (cities.pbf) relative to its own
  // __dirname at runtime — keep it a plain Node require rather than letting
  // the bundler trace/inline it, which drops that file.
  serverExternalPackages: ['all-the-cities'],
};

module.exports = nextConfig;
