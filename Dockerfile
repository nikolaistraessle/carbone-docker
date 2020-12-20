FROM node:latest

WORKDIR /tmp
RUN wget http://downloadarchive.documentfoundation.org/libreoffice/old/7.0.4.2/deb/x86_64/LibreOffice_7.0.4.2_Linux_x86-64_deb.tar.gz -O libo.tar.gz
RUN apt update \
  && apt install -y libxinerama1 libfontconfig1 libdbus-glib-1-2 libcairo2 libcups2 libglu1-mesa libsm6 unzip \
  && tar -zxvf libo.tar.gz
WORKDIR LibreOffice_7.0.4.2_Linux_x86-64_deb/DEBS
RUN dpkg -i *.deb

RUN mkdir -p /tmp
COPY . /carbone-api
WORKDIR /carbone-api
RUN yarn
CMD node index
