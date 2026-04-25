/*
All material copyright ESRI, All Rights Reserved, unless otherwise specified.
See https://js.arcgis.com/4.33/esri/copyright.txt for details.
*/
import{newLayout as e}from"../../support/buffer/InterleavedLayout.js";import{VertexAttribute as O}from"../lib/VertexAttribute.js";const t=e().vec3f(O.POSITION),f=e().vec3f(O.POSITION).vec2f16(O.UV0),r=e().vec3f(O.POSITION).vec4u8(O.COLOR),I=e().vec3f(O.POSITION).vec2f16(O.UV0).vec4u8(O.OLIDCOLOR);export{r as PositionColorLayout,t as PositionLayout,f as PositionUvLayout,I as PositionUvOlidLayout};
