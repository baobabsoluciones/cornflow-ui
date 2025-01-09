FROM node:20-alpine as build


# Accept build args
ARG VUE_APP_I18N_LOCALE
ARG VUE_APP_I18N_FALLBACK_LOCALE
ARG VITE_APP_BACKEND_URL
ARG VITE_APP_AUTH_TYPE
ARG VITE_APP_SCHEMA
ARG VITE_APP_NAME


# Set environment variables
RUN if [ -n "$VUE_APP_I18N_LOCALE" ]; then \
      echo "ENV VUE_APP_I18N_LOCALE=$VUE_APP_I18N_LOCALE" >> /etc/environment; \
    fi;
RUN if [ -n "$VUE_APP_I18N_FALLBACK_LOCALE" ]; then \
      echo "ENV VUE_APP_I18N_FALLBACK_LOCALE=$VUE_APP_I18N_FALLBACK_LOCALE" >> /etc/environment; \
    fi
RUN if [ -n "$VITE_APP_BACKEND_URL" ]; then \
      echo "ENV VITE_APP_BACKEND_URL=$VITE_APP_BACKEND_URL" >> /etc/environment; \
    fi;
RUN if [ -n "$VITE_APP_AUTH_TYPE" ]; then \
      echo "ENV VITE_APP_AUTH_TYPE=$VITE_APP_AUTH_TYPE" >> /etc/environment; \
    fi;
RUN if [ -n "$VITE_APP_SCHEMA" ]; then \
      echo "ENV VITE_APP_SCHEMA=$VITE_APP_SCHEMA" >> /etc/environment; \
    fi;
RUN if [ -n "$VITE_APP_NAME" ]; then \
      echo "ENV VITE_APP_NAME=$VITE_APP_NAME" >> /etc/environment; \
    fi


# install python for gyp pkg
RUN apk --no-cache add --virtual builds-deps build-base python3

# make workdir
WORKDIR /usr/src/app

# copy 'package.json' and 'package-lock.json' (if available)
COPY package*.json ./

# install deps
RUN npm install
RUN npm install @rollup/rollup-linux-x64-gnu --save-optional

# copy files and folder to workdir (/usr/src/app)
COPY . .

# build vue app
RUN npm run build

FROM nginx:stable-alpine as cdn

# copy dist builded vue app to nginx container
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
