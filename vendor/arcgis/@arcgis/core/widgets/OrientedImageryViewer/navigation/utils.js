/*
All material copyright ESRI, All Rights Reserved, unless otherwise specified.
See https://js.arcgis.com/4.33/esri/copyright.txt for details.
*/
import{deg2rad as e}from"../../../core/mathUtils.js";import{getMetersPerUnitForSR as t}from"../../../core/unitUtils.js";import n from"../../../geometry/Extent.js";function r(n,r,i,o){const a=Math.sin(e(r)),s=Math.cos(e(r)),c=Math.sin(e(i)),m=o/t(n.spatialReference),f=m*a*c,p=m*s*c,x=n.clone();return x.x+=f,x.y+=p,x}function i(e,r){const{x:i,y:o,spatialReference:a}=e,s=r/t(a);return new n({xmin:i-s,xmax:i+s,ymin:o-s,ymax:o+s,spatialReference:e.spatialReference})}export{i as createExtentAroundPoint,r as translateInDirection2D};
