(ns docgen.names
  (:require [docgen.ast :as ast]))

(defrecord Named [element namespace path])

(defn make-named [element namespace path]
  (Named. element namespace path))

(defrecord Namespace [])

(defprotocol IsNamed
  (declare-name [this namespace path]))

(extend-type js/Object
  IsNamed
  (declare-name [_ namespace path]
    namespace))

(defn leaf-name [elem name namespace path]
  (assoc namespace (str name) (make-named elem nil (conj path (str name)))))

(extend-type ast/Property
  IsNamed
  (declare-name [{:keys [name] :as this} namespace path]
    (leaf-name this name namespace path)))

(extend-type ast/Parameter
  IsNamed
  (declare-name [{:keys [name] :as this} namespace path]
    (leaf-name this name namespace path)))

(extend-type cljs.core/Symbol
  IsNamed
  (declare-name [this namespace path]
    (leaf-name this (name this) namespace path)))

(defn declare-fn-or-method [{:keys [name signatures] :as this} namespace path]
  (assoc namespace
         name
         (make-named this
                     (reduce #(declare-name %2 %1 (conj path name))
                              (Namespace.)
                              (concat (mapcat :type-args signatures)
                                      (mapcat :params signatures)))
                     (conj path name))))

(extend-type ast/Function
  IsNamed
  (declare-name [this namespace path]
    (declare-fn-or-method this namespace path)))

(extend-type ast/Method
  IsNamed
  (declare-name [this namespace path]
    (declare-fn-or-method this namespace path)))

(extend-type ast/Constructor
  IsNamed
  (declare-name [this namespace path]
    (assoc namespace
           "constructor"
           (make-named this nil (conj path "constructor")))))



(defn -declare-name [{:keys [name members type-args] :as this} namespace path]
  (assoc namespace
         name
         (make-named this
                     (reduce #(declare-name %2 %1 (conj path name))
                             (Namespace.)
                             (concat members type-args))
                     (conj path name))))

(extend-type ast/Interface
  IsNamed
  (declare-name [this ns path]
    (-declare-name this ns path)))

(extend-type ast/Class
  IsNamed
  (declare-name [this ns path]
    (-declare-name this ns path)))

(extend-type ast/Module
  IsNamed
  (declare-name [this ns path]
    (-declare-name this ns path)))

(defn make-namespace [module]
  (declare-name module (Namespace.) []))

(defn resolve [namespace [nm & more] name]
  (or (and nm
           (when-let [kid (get namespace nm)]
             (resolve (:namespace kid) more name)))
      (get namespace name)))
