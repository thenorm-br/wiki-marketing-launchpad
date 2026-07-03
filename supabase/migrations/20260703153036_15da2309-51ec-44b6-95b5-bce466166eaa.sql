
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,graphql_public,wiki';
NOTIFY pgrst, 'reload config';
