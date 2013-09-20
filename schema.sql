--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: fileHashes; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE "fileHashes" (
    "fileHashID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    "hashID" bigint NOT NULL
);


ALTER TABLE public."fileHashes" OWNER TO postgres;

--
-- Name: fileHashes_fileHashID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "fileHashes_fileHashID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."fileHashes_fileHashID_seq" OWNER TO postgres;

--
-- Name: fileHashes_fileHashID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "fileHashes_fileHashID_seq" OWNED BY "fileHashes"."fileHashID";


--
-- Name: fileIndexes; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE "fileIndexes" (
    "indexID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    index tsvector NOT NULL
);


ALTER TABLE public."fileIndexes" OWNER TO postgres;

--
-- Name: fileIndexes_indexID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "fileIndexes_indexID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."fileIndexes_indexID_seq" OWNER TO postgres;

--
-- Name: fileIndexes_indexID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "fileIndexes_indexID_seq" OWNED BY "fileIndexes"."indexID";


--
-- Name: fileLinks; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE "fileLinks" (
    "fileLinkID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    "normalizedURI" text NOT NULL
);


ALTER TABLE public."fileLinks" OWNER TO postgres;

--
-- Name: fileLinks_fileLinkID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "fileLinks_fileLinkID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."fileLinks_fileLinkID_seq" OWNER TO postgres;

--
-- Name: fileLinks_fileLinkID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "fileLinks_fileLinkID_seq" OWNED BY "fileLinks"."fileLinkID";


--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE files (
    "fileID" bigint NOT NULL,
    "internalHash" text NOT NULL,
    type text NOT NULL,
    size bigint NOT NULL
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: files_fileID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "files_fileID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."files_fileID_seq" OWNER TO postgres;

--
-- Name: files_fileID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "files_fileID_seq" OWNED BY files."fileID";


--
-- Name: hashes; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE hashes (
    "hashID" bigint NOT NULL,
    algorithm text NOT NULL,
    hash text NOT NULL
);


ALTER TABLE public.hashes OWNER TO postgres;

--
-- Name: hashes_hashID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "hashes_hashID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."hashes_hashID_seq" OWNER TO postgres;

--
-- Name: hashes_hashID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "hashes_hashID_seq" OWNED BY hashes."hashID";


--
-- Name: remotes; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE remotes (
    "remoteID" bigint NOT NULL,
    "userID" bigint NOT NULL,
    targets text NOT NULL,
    "remoteURL" text NOT NULL,
    query text NOT NULL,
    username text,
    password text
);


ALTER TABLE public.remotes OWNER TO postgres;

--
-- Name: remotes_remoteID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "remotes_remoteID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."remotes_remoteID_seq" OWNER TO postgres;

--
-- Name: remotes_remoteID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "remotes_remoteID_seq" OWNED BY remotes."remoteID";


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE sessions (
    "sessionID" bigint NOT NULL,
    "sessionHash" text NOT NULL,
    "userID" bigint NOT NULL,
    "modeRead" boolean NOT NULL,
    "modeWrite" boolean NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: sessions_sessionID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "sessions_sessionID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."sessions_sessionID_seq" OWNER TO postgres;

--
-- Name: sessions_sessionID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "sessions_sessionID_seq" OWNED BY sessions."sessionID";


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE submissions (
    "submissionID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    "userID" bigint NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.submissions OWNER TO postgres;

--
-- Name: sources_sourceID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "sources_sourceID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."sources_sourceID_seq" OWNER TO postgres;

--
-- Name: sources_sourceID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "sources_sourceID_seq" OWNED BY submissions."submissionID";


--
-- Name: targets; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE targets (
    "targetID" bigint NOT NULL,
    "submissionID" bigint NOT NULL,
    "userID" bigint
);


ALTER TABLE public.targets OWNER TO postgres;

--
-- Name: targets_targetID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "targets_targetID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."targets_targetID_seq" OWNER TO postgres;

--
-- Name: targets_targetID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "targets_targetID_seq" OWNED BY targets."targetID";


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE users (
    "userID" bigint NOT NULL,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "tokenHash" text NOT NULL,
    cert text,
    key text,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "usernameNotPublic" CHECK ((username <> 'public'::text))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_userID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "users_userID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."users_userID_seq" OWNER TO postgres;

--
-- Name: users_userID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "users_userID_seq" OWNED BY users."userID";


--
-- Name: fileHashID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "fileHashes" ALTER COLUMN "fileHashID" SET DEFAULT nextval('"fileHashes_fileHashID_seq"'::regclass);


--
-- Name: indexID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "fileIndexes" ALTER COLUMN "indexID" SET DEFAULT nextval('"fileIndexes_indexID_seq"'::regclass);


--
-- Name: fileLinkID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "fileLinks" ALTER COLUMN "fileLinkID" SET DEFAULT nextval('"fileLinks_fileLinkID_seq"'::regclass);


--
-- Name: fileID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY files ALTER COLUMN "fileID" SET DEFAULT nextval('"files_fileID_seq"'::regclass);


--
-- Name: hashID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY hashes ALTER COLUMN "hashID" SET DEFAULT nextval('"hashes_hashID_seq"'::regclass);


--
-- Name: remoteID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY remotes ALTER COLUMN "remoteID" SET DEFAULT nextval('"remotes_remoteID_seq"'::regclass);


--
-- Name: sessionID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY sessions ALTER COLUMN "sessionID" SET DEFAULT nextval('"sessions_sessionID_seq"'::regclass);


--
-- Name: submissionID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY submissions ALTER COLUMN "submissionID" SET DEFAULT nextval('"sources_sourceID_seq"'::regclass);


--
-- Name: targetID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY targets ALTER COLUMN "targetID" SET DEFAULT nextval('"targets_targetID_seq"'::regclass);


--
-- Name: userID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY users ALTER COLUMN "userID" SET DEFAULT nextval('"users_userID_seq"'::regclass);


--
-- Name: fileHashesPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "fileHashes"
    ADD CONSTRAINT "fileHashesPrimaryKey" PRIMARY KEY ("fileHashID");


--
-- Name: fileIndexesPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "fileIndexes"
    ADD CONSTRAINT "fileIndexesPrimaryKey" PRIMARY KEY ("indexID");


--
-- Name: fileLinksPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "fileLinks"
    ADD CONSTRAINT "fileLinksPrimaryKey" PRIMARY KEY ("fileLinkID");


--
-- Name: fileLinksUnique; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY "fileLinks"
    ADD CONSTRAINT "fileLinksUnique" UNIQUE ("fileID", "normalizedURI");


--
-- Name: filePrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY files
    ADD CONSTRAINT "filePrimaryKey" PRIMARY KEY ("fileID");


--
-- Name: filesUniqueHashAndType; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY files
    ADD CONSTRAINT "filesUniqueHashAndType" UNIQUE ("internalHash", type);


--
-- Name: hashesPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY hashes
    ADD CONSTRAINT "hashesPrimaryKey" PRIMARY KEY ("hashID");


--
-- Name: hashesUnique; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY hashes
    ADD CONSTRAINT "hashesUnique" UNIQUE (algorithm, hash);


--
-- Name: remotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY remotes
    ADD CONSTRAINT remotes_pkey PRIMARY KEY ("remoteID");


--
-- Name: sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY ("sessionID");


--
-- Name: submissionsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY submissions
    ADD CONSTRAINT "submissionsPrimaryKey" PRIMARY KEY ("submissionID");


--
-- Name: targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY targets
    ADD CONSTRAINT targets_pkey PRIMARY KEY ("targetID");


--
-- Name: usersUniqueName; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY users
    ADD CONSTRAINT "usersUniqueName" UNIQUE (username);


--
-- Name: users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY ("userID");


--
-- Name: hashesIndex; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE INDEX "hashesIndex" ON hashes USING btree (algorithm, hash);


--
-- Name: fileHashesOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "fileHashesOnDuplicateDoNothing" AS ON INSERT TO "fileHashes" WHERE (EXISTS (SELECT 1 FROM "fileHashes" old WHERE ((old."fileID" = new."fileID") AND (old."hashID" = new."hashID")))) DO INSTEAD NOTHING;


--
-- Name: fileLinksOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "fileLinksOnDuplicateDoNothing" AS ON INSERT TO "fileLinks" WHERE (EXISTS (SELECT 1 FROM "fileLinks" old WHERE ((old."fileID" = new."fileID") AND (old."normalizedURI" = new."normalizedURI")))) DO INSTEAD NOTHING;


--
-- Name: filesOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "filesOnDuplicateDoNothing" AS ON INSERT TO files WHERE (EXISTS (SELECT 1 FROM files old WHERE ((old."internalHash" = new."internalHash") AND (old.type = new.type)))) DO INSTEAD NOTHING;


--
-- Name: hashesOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "hashesOnDuplicateDoNothing" AS ON INSERT TO hashes WHERE (EXISTS (SELECT 1 FROM hashes old WHERE ((old.algorithm = new.algorithm) AND (old.hash = new.hash)))) DO INSTEAD NOTHING;


--
-- Name: public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

