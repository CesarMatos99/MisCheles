# SQLCipher JNI/native integration relies on these classes in release builds.
# Keep this rule if R8 minification is enabled for the Play build.
-keep class net.sqlcipher.** { *; }
