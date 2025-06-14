//can be used both for relation checks and permission checks
import { ObjectIndex } from '../models/index.js';

export const checkRelation = (subject: string, relation: string, object: string) => {
  if (!subject.includes(':')) {
    throw new Error('Subject must be a valid resource identifier');
  }
  if (!object.includes(':')) {
    throw new Error('Object must be a valid resource identifier');
  }
  if (!/^[a-zA-Z]+$/.test(relation)) {
    throw new Error('Relation must be a plain string');
  }
  if (subject === object) {
    throw new Error('Subject and object must be different');
  }
  return;
};

export const computeRelationTuple = (
  subject: string,
  relation: string,
  object: string,
) => {
  return `${subject}#${relation}@${object}`;
};

export const computePermissionTuple = (
  subject: string,
  relation: string,
  object: string,
) => {
  return `${subject}#${relation}@${object}`;
};

export const constructObjectIndex = (
  subject: string,
  permission: string,
  role: string,
  object: string,
  inheritanceTree: string[],
): Partial<ObjectIndex> => {
  const wildcard = role === '*' || object === '*';
  return {
    subject: `${subject}#${permission}`,
    subjectId: subject.split(':')[1],
    subjectType: subject.split(':')[0],
    subjectPermission: permission,
    entity: wildcard ? '*' : `${object}#${role}`,
    entityId: wildcard ? '*' : object.split(':')[1],
    entityType: wildcard ? '*' : object.split(':')[0],
    relation: wildcard ? '*' : role,
    inheritanceTree: inheritanceTree,
  };
};

/**
 * Generates a SQL query fetching an access list for Postgres databases.
 *
 * @param {string} objectTypeCollection Collection to query.
 * @param {string} computedTuple Computed permission tuple.
 * @param {string} subject Subject identifier.
 * @param {string} objectType Object type.
 * @param {string} action Action being checked.
 * @returns {string} The generated SQL query.
 */
export function getPostgresAccessListQuery(
  objectTypeCollection: string,
  computedTuple: string,
  subject: string,
  objectType: string,
  action: string,
) {
  return `
      SELECT s.*
      FROM "${objectTypeCollection}" as s
               INNER JOIN ((SELECT obj.entity
                            FROM (SELECT *
                                  FROM "cnd_ActorIndex"
                                  WHERE subject = '${subject}') as actors
                                     INNER JOIN (SELECT *
                                                 FROM "cnd_ObjectIndex"
                                                 WHERE "subjectType" = '${objectType}'
                                                   AND "subjectPermission" = '${action}') as obj
                                                ON actors.entity = obj.entity OR obj.entity = '*')
                           UNION
                           (SELECT "computedTuple"
                            FROM "cnd_Permission"
                            WHERE "computedTuple" LIKE '${computedTuple}%')) idx
                          ON idx.entity LIKE '%' || TEXT(s._id) || '%'
  `;
}

/**
 * Generates a SQL query fetching an access list for generic SQL databases.
 *
 * @param {string} objectTypeCollection Collection to query.
 * @param {string} computedTuple Computed permission tuple.
 * @param {string} subject Subject identifier.
 * @param {string} objectType Object type.
 * @param {string} action Action being checked.
 * @returns {string} The generated SQL query.
 */
export function getSQLAccessListQuery(
  objectTypeCollection: string,
  computedTuple: string,
  subject: string,
  objectType: string,
  action: string,
) {
  return `SELECT ${objectTypeCollection}.*
          FROM ${objectTypeCollection}
                   INNER JOIN (SELECT *
                               FROM cnd_Permission
                               WHERE computedTuple LIKE '${computedTuple}%') permissions
                              ON permissions.computedTuple = '${computedTuple}:' || ${objectTypeCollection}._id
                   INNER JOIN (SELECT *
                               FROM cnd_ActorIndex
                               WHERE subject = '${subject}') actors ON 1 = 1
                   INNER JOIN (SELECT *
                               FROM cnd_ObjectIndex
                               WHERE "subjectType" = '${objectType}'
                                 AND "subjectPermission" = '${action}') objects
                              ON actors.entity = obj.entity OR obj.entity = '*';`;
}
