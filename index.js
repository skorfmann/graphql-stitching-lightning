import express from 'express';
import bodyParser from 'body-parser';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';

import { introspectSchema, makeRemoteExecutableSchema, mergeSchemas } from 'graphql-tools';
import { HttpLink } from 'apollo-link-http';
import fetch from 'node-fetch';

const makeRemoteSchema = async (link) => {
  const remoteSchema = await introspectSchema(link);
  const executableSchema = makeRemoteExecutableSchema({
    schema: remoteSchema,
    link,
  });
  return executableSchema;
}

const spotifyLink = new HttpLink({
  uri: "https://spotify-graphql-server.herokuapp.com/graphql",
  fetch
});

const demoLink = new HttpLink({ uri: "http://localhost:3001/graphql", fetch });

Promise.all([makeRemoteSchema(spotifyLink), makeRemoteSchema(demoLink)])
  .then(([spotifySchema, demoSchema]) => {
    const linkTypeDefs = `
    extend type Record {
      spotify: [Artist]
    }
  `;

    const schema = mergeSchemas({
      schemas: [spotifySchema, demoSchema, linkTypeDefs],
      resolvers: mergeInfo => ({
        Record: {
          spotify: {
            resolve: (parent, args, context, info) => {
              const artistName = parent.artist;
              return mergeInfo.delegate(
                "query",
                "queryArtists",
                {
                  byName: artistName
                },
                context,
                info
              );
            }
          }
        }
      })
    });

    const app = express();

    app.use("/graphiql", graphiqlExpress({ endpointURL: "/graphql" }));
    app.use("/graphql", bodyParser.json(), graphqlExpress({ schema }));
    app.listen(3000);
  })
  .catch(err => {
    console.log(err);
  });

