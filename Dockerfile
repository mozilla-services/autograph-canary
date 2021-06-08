# Define custom function directory
ARG FUNCTION_DIR="/function"

FROM python:3.8-buster as build-image
ENV DEBIAN_FRONTEND=noninteractive

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Install aws-lambda-cpp build dependencies
RUN apt-get update && \
  apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev

RUN mkdir -p ${FUNCTION_DIR}/tests

ADD requirements.txt ${FUNCTION_DIR}

# Install the function's dependencies
RUN pip install --target ${FUNCTION_DIR} -r ${FUNCTION_DIR}/requirements.txt

# add function code
ADD autograph.py ${FUNCTION_DIR}
COPY tests ${FUNCTION_DIR}/tests

FROM python:3.8-buster
ENV DEBIAN_FRONTEND=noninteractive

# run firefox in headless mode
ENV MOZ_HEADLESS=1

ENV CANARY_LOG_LEVEL=debug
ENV TEST_FILES_GLOB="*_test.js"
ENV XPI_ENV="prod"
ENV XPI_URLS="https://addons.mozilla.org/firefox/downloads/file/3772109/facebook_container-2.2.1-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3713375/firefox_multi_account_containers-7.3.0-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3768975/ublock_origin-1.35.2-an+fx.xpi"
ENV CSIG_ENV="prod"
ENV CSIG_COLLECTIONS="blocklists/gfx,blocklists/addons-bloomfilters,blocklists/plugins,blocklists/addons,blocklists/certificates,main/normandy-recipes,main/normandy-recipes-capabilities,main/hijack-blocklists,main/search-config,security-state/onecrl,security-state/intermediates"

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# install fx release w/ deps and 7zip for tls-canary
RUN apt-get update \
    && echo 'deb http://deb.debian.org/debian unstable main' > /etc/apt/sources.list.d/unstable.list \
    && apt update \
    && apt-get install -y -t unstable firefox

# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# add version.json for dockerflow
RUN mkdir -p /app/
ADD version.json /app/

# Copy in the built dependencies
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

CMD [ "/usr/local/bin/python", "autograph.py" ]
