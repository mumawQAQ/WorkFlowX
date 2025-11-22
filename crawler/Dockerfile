ARG BASE_IMAGE=apify/actor-node-playwright-chrome:20
ARG BASE_PLATFORM=linux/amd64

# The upstream Apify image is only published for linux/amd64, so we force that
# platform to avoid Docker trying (and failing) to pull a nonexistent arch build.
FROM --platform=${BASE_PLATFORM} ${BASE_IMAGE} AS builder

WORKDIR /home/myuser/app

# Copy the monorepo sources so we can build both the shared db package
# and the crawler code in one go.
COPY --chown=myuser packages ./packages
COPY --chown=myuser crawler ./crawler

# Build the shared database package first so its compiled output exists
# before the crawler installs it via the local file dependency.
WORKDIR /home/myuser/app/packages/db
RUN npm install --include=dev --audit=false
RUN npm run prisma:generate
RUN npm run build

# Build the crawler, which depends on the compiled db package.
WORKDIR /home/myuser/app/crawler
RUN npm install --include=dev --audit=false
RUN npm run build

# Create final image on the same platform as the builder stage.
FROM --platform=${BASE_PLATFORM} ${BASE_IMAGE}

# Copy source files required at runtime.
WORKDIR /home/myuser/app
COPY --chown=myuser crawler ./crawler
COPY --chown=myuser packages/db ./packages/db

# Overlay the compiled outputs from the builder stage.
COPY --from=builder --chown=myuser /home/myuser/app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=myuser /home/myuser/app/crawler/dist ./crawler/dist

# Install runtime dependencies for the crawler (which will install the local
# db package via the file:../packages/db reference) and output basic diagnostics.
WORKDIR /home/myuser/app/crawler
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

# Run the image. If you know you won't need headful browsers,
# you can remove the XVFB start script for a micro perf gain.
CMD ["sh", "-c", "/home/myuser/start_xvfb_and_run_cmd.sh && npm run start:prod --silent"]
