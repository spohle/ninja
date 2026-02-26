# STAGE 1: Builder 
# this stage only exists to download and unpack. it will be discarded later
FROM --platform=linux/amd64 ubuntu:22.04 AS builder

# Install only what we need to fetch the software
RUN apt-get update && apt-get install -y curl xz-utils

WORKDIR /setup

# download blender 5.0.1
RUN curl -f -L -o blender.tar.xz https://download.blender.org/release/Blender5.0/blender-5.0.1-linux-x64.tar.xz

# unpack it and remove the compressed file to save space
RUN tar -xJf blender.tar.xz --strip-components=1 && rm blender.tar.xz


# STAGE 2: Image
FROM --platform=linux/amd64 ubuntu:22.04

# prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# install only the runtime libraries blender needs to execute
RUN apt-get update && apt-get install -y \
    libglu1-mesa \
    libxi6 \
    libxrender1 \
    libxkbcommon0 \
    libsm6 \
    libgl1 \
    libfontconfig1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# copy the clean, unpacked blender folder from the builder stage
# this is the magic of multi-stage: we leave the curl and xz behind
COPY --from=builder /setup /opt/blender

# set up the symlink and working directory
RUN ln -s /opt/blender/blender /usr/local/bin/blender
WORKDIR /render

CMD ["blender", "--version"]
