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
-- Name: entries; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE entries (
    "entryID" bigint NOT NULL,
    "nameID" bigint NOT NULL,
    "MIMEType" text NOT NULL,
    "time" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.entries OWNER TO postgres;

--
-- Name: entries_entryID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "entries_entryID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."entries_entryID_seq" OWNER TO postgres;

--
-- Name: entries_entryID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "entries_entryID_seq" OWNED BY entries."entryID";


--
-- Name: names; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE names (
    "nameID" bigint NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.names OWNER TO postgres;

--
-- Name: names_nameID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "names_nameID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."names_nameID_seq" OWNER TO postgres;

--
-- Name: names_nameID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "names_nameID_seq" OWNED BY names."nameID";


--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres; Tablespace: 
--

CREATE TABLE tags (
    "tagID" bigint NOT NULL,
    "nameID" bigint NOT NULL,
    "impliedID" bigint NOT NULL,
    direct boolean NOT NULL,
    indirect bigint NOT NULL
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: tags_tagID_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "tags_tagID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."tags_tagID_seq" OWNER TO postgres;

--
-- Name: tags_tagID_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "tags_tagID_seq" OWNED BY tags."tagID";


--
-- Name: entryID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY entries ALTER COLUMN "entryID" SET DEFAULT nextval('"entries_entryID_seq"'::regclass);


--
-- Name: nameID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY names ALTER COLUMN "nameID" SET DEFAULT nextval('"names_nameID_seq"'::regclass);


--
-- Name: tagID; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY tags ALTER COLUMN "tagID" SET DEFAULT nextval('"tags_tagID_seq"'::regclass);


--
-- Name: entriesPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY entries
    ADD CONSTRAINT "entriesPrimaryKey" PRIMARY KEY ("entryID");


--
-- Name: entriesUniqueName; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY entries
    ADD CONSTRAINT "entriesUniqueName" UNIQUE ("nameID");


--
-- Name: namesPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY names
    ADD CONSTRAINT "namesPrimaryKey" PRIMARY KEY ("nameID");


--
-- Name: namesUniqueName; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY names
    ADD CONSTRAINT "namesUniqueName" UNIQUE (name);


--
-- Name: tagsPrimaryKey; Type: CONSTRAINT; Schema: public; Owner: postgres; Tablespace: 
--

ALTER TABLE ONLY tags
    ADD CONSTRAINT "tagsPrimaryKey" PRIMARY KEY ("tagID");


--
-- Name: fki_entriesForeignKeyNameID; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE INDEX "fki_entriesForeignKeyNameID" ON entries USING btree ("nameID");


--
-- Name: namesNameIndex; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE UNIQUE INDEX "namesNameIndex" ON names USING btree (name);


--
-- Name: tagsNameImplicationIndex; Type: INDEX; Schema: public; Owner: postgres; Tablespace: 
--

CREATE UNIQUE INDEX "tagsNameImplicationIndex" ON tags USING btree ("nameID", "impliedID");


--
-- Name: namesIgnoreDuplicates; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "namesIgnoreDuplicates" AS ON INSERT TO names WHERE (EXISTS (SELECT 1 FROM names WHERE (names.name = new.name))) DO INSTEAD NOTHING;


--
-- Name: tagsUpdateOrInsert; Type: RULE; Schema: public; Owner: postgres
--

CREATE RULE "tagsUpdateOrInsert" AS ON INSERT TO tags WHERE (EXISTS (SELECT 1 FROM tags WHERE ((tags."nameID" = new."nameID") AND (tags."impliedID" = new."impliedID")))) DO INSTEAD UPDATE tags SET indirect = new.indirect WHERE ((tags."nameID" = new."nameID") AND (tags."impliedID" = new."impliedID"));


--
-- Name: entriesForeignKeyNameID; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY entries
    ADD CONSTRAINT "entriesForeignKeyNameID" FOREIGN KEY ("nameID") REFERENCES names("nameID") ON DELETE RESTRICT;


--
-- Name: tagsForeignKeyNameID; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY tags
    ADD CONSTRAINT "tagsForeignKeyNameID" FOREIGN KEY ("nameID") REFERENCES names("nameID") ON DELETE RESTRICT;


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

