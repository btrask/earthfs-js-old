--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: URIs; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE "URIs" (
    "URIID" bigint NOT NULL,
    "normalizedURI" text NOT NULL
);


--
-- Name: URIs_URIID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "URIs_URIID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: URIs_URIID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "URIs_URIID_seq" OWNED BY "URIs"."URIID";


--
-- Name: fieldLinks; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE "fieldLinks" (
    "fieldLinkID" bigint NOT NULL,
    "fieldID" bigint NOT NULL,
    "URIID" bigint NOT NULL,
    relation text NOT NULL
);


--
-- Name: fieldLinks_fieldLinkID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "fieldLinks_fieldLinkID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fieldLinks_fieldLinkID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "fieldLinks_fieldLinkID_seq" OWNED BY "fieldLinks"."fieldLinkID";


--
-- Name: fieldScalars; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE "fieldScalars" (
    "fieldScalarID" bigint NOT NULL,
    "fieldID" bigint NOT NULL,
    type text NOT NULL,
    value double precision NOT NULL
);


--
-- Name: fieldScalars_fieldScalarID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "fieldScalars_fieldScalarID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fieldScalars_fieldScalarID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "fieldScalars_fieldScalarID_seq" OWNED BY "fieldScalars"."fieldScalarID";


--
-- Name: fields; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE fields (
    "fieldID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    name text NOT NULL,
    value text NOT NULL,
    index tsvector NOT NULL
);


--
-- Name: fields_fieldID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "fields_fieldID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fields_fieldID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "fields_fieldID_seq" OWNED BY fields."fieldID";


--
-- Name: fileURIs; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE "fileURIs" (
    "fileURIID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    "URIID" bigint NOT NULL
);


--
-- Name: fileURIs_fileURIID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "fileURIs_fileURIID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fileURIs_fileURIID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "fileURIs_fileURIID_seq" OWNED BY "fileURIs"."fileURIID";


--
-- Name: files; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE files (
    "fileID" bigint NOT NULL,
    "internalHash" text NOT NULL,
    type text NOT NULL,
    size bigint NOT NULL
);


--
-- Name: files_fileID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "files_fileID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: files_fileID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "files_fileID_seq" OWNED BY files."fileID";


--
-- Name: pulls; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE pulls (
    "pullID" bigint NOT NULL,
    "userID" bigint NOT NULL,
    targets text NOT NULL,
    "URI" text NOT NULL,
    "queryString" text NOT NULL,
    "queryLanguage" text NOT NULL,
    username text NOT NULL,
    password text NOT NULL
);


--
-- Name: pulls_pullID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "pulls_pullID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pulls_pullID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "pulls_pullID_seq" OWNED BY pulls."pullID";


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE sessions (
    "sessionID" bigint NOT NULL,
    "sessionHash" text NOT NULL,
    "userID" bigint NOT NULL,
    "modeRead" boolean NOT NULL,
    "modeWrite" boolean NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions_sessionID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "sessions_sessionID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_sessionID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "sessions_sessionID_seq" OWNED BY sessions."sessionID";


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE submissions (
    "submissionID" bigint NOT NULL,
    "fileID" bigint NOT NULL,
    "userID" bigint NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sources_sourceID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "sources_sourceID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sources_sourceID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "sources_sourceID_seq" OWNED BY submissions."submissionID";


--
-- Name: targets; Type: TABLE; Schema: public; Owner: -; Tablespace: 
--

CREATE TABLE targets (
    "targetID" bigint NOT NULL,
    "submissionID" bigint NOT NULL,
    "userID" bigint
);


--
-- Name: targets_targetID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "targets_targetID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: targets_targetID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "targets_targetID_seq" OWNED BY targets."targetID";


--
-- Name: users; Type: TABLE; Schema: public; Owner: -; Tablespace: 
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


--
-- Name: users_userID_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "users_userID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_userID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "users_userID_seq" OWNED BY users."userID";


--
-- Name: URIID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "URIs" ALTER COLUMN "URIID" SET DEFAULT nextval('"URIs_URIID_seq"'::regclass);


--
-- Name: fieldLinkID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "fieldLinks" ALTER COLUMN "fieldLinkID" SET DEFAULT nextval('"fieldLinks_fieldLinkID_seq"'::regclass);


--
-- Name: fieldScalarID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "fieldScalars" ALTER COLUMN "fieldScalarID" SET DEFAULT nextval('"fieldScalars_fieldScalarID_seq"'::regclass);


--
-- Name: fieldID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY fields ALTER COLUMN "fieldID" SET DEFAULT nextval('"fields_fieldID_seq"'::regclass);


--
-- Name: fileURIID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "fileURIs" ALTER COLUMN "fileURIID" SET DEFAULT nextval('"fileURIs_fileURIID_seq"'::regclass);


--
-- Name: fileID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY files ALTER COLUMN "fileID" SET DEFAULT nextval('"files_fileID_seq"'::regclass);


--
-- Name: pullID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY pulls ALTER COLUMN "pullID" SET DEFAULT nextval('"pulls_pullID_seq"'::regclass);


--
-- Name: sessionID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY sessions ALTER COLUMN "sessionID" SET DEFAULT nextval('"sessions_sessionID_seq"'::regclass);


--
-- Name: submissionID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY submissions ALTER COLUMN "submissionID" SET DEFAULT nextval('"sources_sourceID_seq"'::regclass);


--
-- Name: targetID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY targets ALTER COLUMN "targetID" SET DEFAULT nextval('"targets_targetID_seq"'::regclass);


--
-- Name: userID; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY users ALTER COLUMN "userID" SET DEFAULT nextval('"users_userID_seq"'::regclass);


--
-- Name: URIsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY "URIs"
    ADD CONSTRAINT "URIsPrimaryKey" PRIMARY KEY ("URIID");


--
-- Name: fieldLinksPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY "fieldLinks"
    ADD CONSTRAINT "fieldLinksPrimaryKey" PRIMARY KEY ("fieldLinkID");


--
-- Name: fieldScalarsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY "fieldScalars"
    ADD CONSTRAINT "fieldScalarsPrimaryKey" PRIMARY KEY ("fieldScalarID");


--
-- Name: fieldsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY fields
    ADD CONSTRAINT "fieldsPrimaryKey" PRIMARY KEY ("fieldID");


--
-- Name: filePrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY files
    ADD CONSTRAINT "filePrimaryKey" PRIMARY KEY ("fileID");


--
-- Name: fileURIsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY "fileURIs"
    ADD CONSTRAINT "fileURIsPrimaryKey" PRIMARY KEY ("fileURIID");


--
-- Name: filesUniqueHashAndType; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY files
    ADD CONSTRAINT "filesUniqueHashAndType" UNIQUE ("internalHash", type);


--
-- Name: pullsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY pulls
    ADD CONSTRAINT "pullsPrimaryKey" PRIMARY KEY ("pullID");


--
-- Name: sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY ("sessionID");


--
-- Name: submissionsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY submissions
    ADD CONSTRAINT "submissionsPrimaryKey" PRIMARY KEY ("submissionID");


--
-- Name: targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY targets
    ADD CONSTRAINT targets_pkey PRIMARY KEY ("targetID");


--
-- Name: usersUniqueName; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY users
    ADD CONSTRAINT "usersUniqueName" UNIQUE (username);


--
-- Name: users_pkey; Type: CONSTRAINT; Schema: public; Owner: -; Tablespace: 
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY ("userID");


--
-- Name: URIs_normalizedURI_idx; Type: INDEX; Schema: public; Owner: -; Tablespace: 
--

CREATE UNIQUE INDEX "URIs_normalizedURI_idx" ON "URIs" USING btree ("normalizedURI");


--
-- Name: URIsOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: -
--

CREATE RULE "URIsOnDuplicateDoNothing" AS ON INSERT TO "URIs" WHERE (EXISTS (SELECT 1 FROM "URIs" old WHERE (old."normalizedURI" = new."normalizedURI"))) DO INSTEAD NOTHING;


--
-- Name: fileURIsOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: -
--

CREATE RULE "fileURIsOnDuplicateDoNothing" AS ON INSERT TO "fileURIs" WHERE (EXISTS (SELECT 1 FROM "fileURIs" old WHERE ((old."fileID" = new."fileID") AND (old."URIID" = new."URIID")))) DO INSTEAD NOTHING;


--
-- Name: filesOnDuplicateDoNothing; Type: RULE; Schema: public; Owner: -
--

CREATE RULE "filesOnDuplicateDoNothing" AS ON INSERT TO files WHERE (EXISTS (SELECT 1 FROM files old WHERE ((old."internalHash" = new."internalHash") AND (old.type = new.type)))) DO INSTEAD NOTHING;


--
-- Name: public; Type: ACL; Schema: -; Owner: -
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

