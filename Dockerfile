FROM node:latest AS build-env

COPY . /carbone-api
WORKDIR /carbone-api
RUN yarn install

FROM node:slim

COPY index.js /carbone-api/index.js
COPY test.html /carbone-api/test.html
COPY package.json /carbone-api/package.json
COPY yarn.lock /carbone-api/yarn.lock
COPY --from=build-env /carbone-api/node_modules /carbone-api/node_modules
WORKDIR /tmp
RUN apt-get update \
  && apt-get install -y libxinerama1 libfontconfig1 libdbus-glib-1-2 libcairo2 libcups2 libglu1-mesa libsm6 unzip wget \
  && wget http://downloadarchive.documentfoundation.org/libreoffice/old/7.0.4.2/deb/x86_64/LibreOffice_7.0.4.2_Linux_x86-64_deb.tar.gz -O libo.tar.gz \
  && tar -zxvf libo.tar.gz \
  && cd LibreOffice_7.0.4.2_Linux_x86-64_deb/DEBS \
  && dpkg -i *.deb \
  && rm -rf /tmp/*


COPY fonts/* /usr/share/fonts/
RUN mv /usr/share/fonts/*.ttf /usr/share/fonts/truetype

RUN mkdir -p /tmp
WORKDIR /carbone-api
RUN yarn
CMD node index
