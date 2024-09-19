FROM node:20-alpine as build

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
